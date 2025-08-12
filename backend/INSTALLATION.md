# Guide d'Installation Complet

Ce guide vous accompagne dans l'installation complète du système de monitoring des moteurs avec prédictions IA.

## Architecture du Système

```
┌─────────────────┐    MQTT     ┌─────────────────┐    API/WS   ┌─────────────────┐
│   Raspberry Pi  │◄─────────►│  Backend Node.js │◄──────────►│   Frontend React │
│   + ESP32       │             │   + Supabase    │             │   + Tailwind    │
│   (Prédictions) │             │   (Stockage)    │             │   (Interface)   │
└─────────────────┘             └─────────────────┘             └─────────────────┘
```

## 🔧 Prérequis

### Matériel Requis
- **Raspberry Pi 5** (ou 4) avec Raspbian OS
- **ESP32** avec capteurs (température, accéléromètre, microphone)
- **Ordinateur de développement** (Windows/Mac/Linux)

### Logiciels Requis
- **Node.js** 16+ ([télécharger](https://nodejs.org/))
- **Python** 3.8+ (pour Raspberry Pi)
- **Git** ([télécharger](https://git-scm.com/))
- **Compte Supabase** ([s'inscrire](https://supabase.com/))

## 📱 1. Configuration du Frontend

### Installation
```bash
# Cloner le projet
git clone <votre-repo>
cd <nom-du-projet>

# Installer les dépendances
npm install
```

### Configuration
Créer le fichier `.env.local`:
```env
VITE_API_URL=http://localhost:3001
```

### Démarrage
```bash
npm run dev
```
→ Frontend disponible sur http://localhost:5173

## 🖥️ 2. Configuration du Backend

### Installation
```bash
cd backend

# Installation automatique
chmod +x install.sh
./install.sh

# OU installation manuelle
npm install
cp .env.example .env
```

### Configuration Supabase
1. Créer un projet sur [Supabase](https://supabase.com/)
2. Récupérer l'URL et les clés API
3. Configurer le fichier `.env`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# MQTT Configuration
MQTT_BROKER=127.0.0.1
MQTT_PORT=1883

# Supabase Configuration
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# CORS Configuration
FRONTEND_URL=http://localhost:5173
```

### Configuration Base de Données
Les tables seront créées automatiquement au démarrage, ou exécutez:
```sql
-- Exécuter le script sql/create_tables.sql dans Supabase
```

### Démarrage
```bash
# Développement
npm run dev

# Production
npm start

# Avec PM2 (optionnel)
pm2 start ecosystem.config.js
```
→ Backend disponible sur http://localhost:3001

## 🔧 3. Configuration MQTT Broker

### Installation Mosquitto

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

#### macOS
```bash
brew install mosquitto
brew services start mosquitto
```

#### Windows
Télécharger depuis [mosquitto.org](https://mosquitto.org/download/)

### Test MQTT
```bash
# Terminal 1 - S'abonner aux messages
mosquitto_sub -h localhost -t "machine/+/data"

# Terminal 2 - Publier un message test
mosquitto_pub -h localhost -t "machine/moteur1/data" -m '{"temperature_c":25.5,"accel_x_g":0.02}'
```

## 🍓 4. Configuration Raspberry Pi

### Installation des Dépendances Python
```bash
# Sur le Raspberry Pi
sudo apt-get update
sudo apt-get install python3-pip

# Installer les bibliothèques ML
pip3 install pandas numpy scipy scikit-learn tensorflow joblib paho-mqtt
```

### Préparation des Modèles
1. Entraîner vos modèles ML (XGBoost + CNN-LSTM)
2. Sauvegarder les fichiers:
   - `xgboost_motor_model.pkl`
   - `cnn_lstm_motor_model.h5`
   - `label_encoder.pkl`
   - `xgb_feature_columns.pkl`
   - `dl_raw_data_columns.pkl`
   - `dl_scaler.pkl`

### Script de Prédiction
Le script Python que vous avez fourni doit être placé sur le Raspberry Pi avec les fichiers de modèles.

```bash
# Sur le Raspberry Pi
python3 prediction_script.py
```

## 🔌 5. Configuration ESP32

### Code ESP32 (exemple)
```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "VotreWiFi";
const char* password = "VotreMotDePasse";
const char* mqtt_server = "192.168.1.100"; // IP du Raspberry Pi

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  // Configuration capteurs
  setupWiFi();
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Lire les capteurs
  float temp = readTemperature();
  float accel_x = readAccelX();
  float accel_y = readAccelY();
  float accel_z = readAccelZ();
  int sound = readSound();
  
  // Publier les données
  publishSensorData(temp, accel_x, accel_y, accel_z, sound);
  
  delay(100); // 100ms comme dans le script Python
}
```

## 🚀 6. Démarrage du Système Complet

### Ordre de Démarrage
1. **Supabase** (base de données cloud)
2. **MQTT Broker** (Mosquitto)
3. **Backend Node.js**
4. **Frontend React**
5. **ESP32** (capteurs)
6. **Raspberry Pi** (prédictions)

### Vérification  
1. **Frontend**: http://localhost:5173
2. **Backend API**: http://localhost:3001/health
3. **MQTT**: `mosquitto_sub -h localhost -t "machine/+/alerts"`

## 📊 7. Test du Système

### Test avec Données Simulées
```bash
# Publier des données de test
mosquitto_pub -h localhost -t "machine/moteur1/data" -m '{
  "timestamp": "2025-01-08T10:00:00.000Z",
  "temperature_c": 35.1,
  "accel_x_g": 0.02,
  "accel_y_g": 0.01,
  "accel_z_g": 0.99,
  "raw_sound_analog": 1500,
  "sound_amplitude": 65.2
}'
```

### Test de Prédiction
```bash
# Publier une alerte de test
mosquitto_pub -h localhost -t "machine/moteur1/alerts" -m '{
  "machineId": "moteur1",
  "type": "Bearing",
  "severity": "elevated",
  "message": "Test anomalie détectée",
  "timestamp": "2025-01-08T10:00:00.000Z",
  "details": {
    "xgb_prediction": "Bearing",
    "xgb_confidence": 0.85,
    "dl_prediction": "Normal",
    "dl_confidence": 0.60
  }
}'
```

## 🔧 8. Dépannage

### Problèmes Courants

#### Frontend ne se connecte pas au Backend
- Vérifier que le backend fonctionne: `curl http://localhost:3001/health`
- Vérifier la configuration `VITE_API_URL`
- Vérifier les CORS dans le backend

#### MQTT ne fonctionne pas
```bash
# Tester Mosquitto
mosquitto_pub -h localhost -t test -m "hello"
mosquitto_sub -h localhost -t test
```

#### Base de données non accessible
- Vérifier les clés Supabase dans `.env`
- Vérifier la connexion internet
- Consulter les logs Supabase

#### Raspberry Pi ne envoie pas de prédictions
- Vérifier que tous les fichiers de modèles sont présents
- Vérifier la connexion MQTT du Raspberry Pi
- Consulter les logs Python

### Logs Utiles
```bash
# Backend
npm run dev  # Logs en temps réel

# MQTT
mosquitto_sub -h localhost -t "#"  # Tous les messages

# Raspberry Pi
python3 prediction_script.py  # Logs des prédictions
```

## 📈 9. Optimisation et Production

### Backend Production
```bash
# Avec PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Surveillance
- Logs PM2: `pm2 logs`
- Monitoring Supabase via dashboard
- Métriques MQTT via Mosquitto logs

### Sécurité
- Configurer HTTPS en production
- Sécuriser MQTT avec authentification
- Limiter l'accès à Supabase

## 🆘 Support

### Resources
- **Documentation API**: `backend/README.md`
- **Logs Backend**: `pm2 logs` ou console Node.js
- **Logs Frontend**: Console navigateur (F12)
- **Test MQTT**: Mosquitto clients

### Contacts
- Issues GitHub pour les bugs
- Documentation Supabase: [docs.supabase.com](https://docs.supabase.com/)
- Documentation MQTT: [mqtt.org](https://mqtt.org/)

Ce guide couvre l'installation complète du système. Suivez les étapes dans l'ordre pour un déploiement réussi ! 🎉