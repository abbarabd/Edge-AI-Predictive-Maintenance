#!/bin/bash

# Script d'installation pour le backend Node.js
echo "🚀 Installation du backend Node.js pour le monitoring des moteurs..."

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js (version 16 ou supérieure)"
    exit 1
fi

# Vérifier la version de Node.js
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 ou supérieure requise. Version actuelle: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Configurez le fichier .env avec vos paramètres:"
    echo "   - URL et clés Supabase"
    echo "   - Configuration MQTT si nécessaire"
    echo "   - URL du frontend"
fi

# Installation optionnelle de PM2 pour la production
read -p "🤖 Voulez-vous installer PM2 pour la gestion des processus en production? (y/N): " install_pm2
if [[ $install_pm2 =~ ^[Yy]$ ]]; then
    npm install -g pm2
    echo "✅ PM2 installé"
    
    # Créer le fichier de configuration PM2
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'motor-monitoring-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
EOF
    echo "✅ Configuration PM2 créée (ecosystem.config.js)"
fi

# Installation optionnelle de Mosquitto MQTT Broker
read -p "🦟 Voulez-vous installer Mosquitto MQTT Broker localement? (y/N): " install_mosquitto
if [[ $install_mosquitto =~ ^[Yy]$ ]]; then
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        sudo apt-get update
        sudo apt-get install -y mosquitto mosquitto-clients
        sudo systemctl enable mosquitto
        sudo systemctl start mosquitto
        echo "✅ Mosquitto installé et démarré"
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        sudo yum install -y epel-release
        sudo yum install -y mosquitto mosquitto-clients
        sudo systemctl enable mosquitto
        sudo systemctl start mosquitto
        echo "✅ Mosquitto installé et démarré"
    elif command -v brew &> /dev/null; then
        # macOS
        brew install mosquitto
        brew services start mosquitto
        echo "✅ Mosquitto installé et démarré"
    else
        echo "⚠️  Installation manuelle requise pour Mosquitto MQTT Broker"
        echo "   Visitez: https://mosquitto.org/download/"
    fi
fi

echo ""
echo "🎉 Installation terminée!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Configurez le fichier .env avec vos paramètres"
echo "2. Assurez-vous que votre base de données Supabase est configurée"
echo "3. Démarrez le serveur:"
echo "   - Développement: npm run dev"
echo "   - Production: npm start"
if [[ $install_pm2 =~ ^[Yy]$ ]]; then
echo "   - Production avec PM2: pm2 start ecosystem.config.js"
fi
echo ""
echo "🔗 URLs importantes:"
echo "   - API Backend: http://localhost:3001"
echo "   - Health Check: http://localhost:3001/health"
echo "   - Documentation API: Voir README.md"
echo ""
echo "📡 Configuration MQTT:"
echo "   - Topics d'écoute: machine/+/data, machine/+/alerts"
echo "   - Broker par défaut: 127.0.0.1:1883"
echo ""