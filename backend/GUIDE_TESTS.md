# Guide de Tests - Système de Monitoring des Moteurs

## 🎯 Objectif
Tester la liaison complète Frontend ↔ Backend ↔ Supabase avec des données simulées, sans Raspberry Pi.

## 📋 Prérequis

### 1. Configuration Supabase
Vous devez avoir un projet Supabase avec :
- URL du projet
- Clé publique (anon key)
- Clé de service (service_role key)

### 2. Variables d'environnement Backend
Créez le fichier `backend/.env` :
```env
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# CORS Configuration
FRONTEND_URL=http://localhost:5173

# MQTT Configuration (optionnel pour les tests)
MQTT_BROKER=127.0.0.1
MQTT_PORT=1883
```

## 🚀 Étapes de Test

### Étape 1: Installation et Démarrage

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
# Dans le dossier principal
npm install
npm run dev
```

### Étape 2: Vérification de la Base de Données

1. **Test de connexion backend** :
   ```bash
   curl http://localhost:3001/health
   ```
   Réponse attendue : `{"status":"OK","timestamp":"...","version":"1.0.0"}`

2. **Vérification des tables Supabase** :
   - Connectez-vous à votre dashboard Supabase
   - Vérifiez que les tables suivantes ont été créées :
     - `motors`
     - `raw_sensor_data`
     - `anomalies`
     - `predictions`

3. **Test API Motors** :
   ```bash
   curl http://localhost:3001/api/motors
   ```
   Doit retourner la liste des moteurs avec données initiales.

### Étape 3: Test du Simulateur de Données

1. **Vérifier le statut du simulateur** :
   ```bash
   curl http://localhost:3001/api/simulator/status
   ```

2. **Démarrer le simulateur** (si pas déjà actif) :
   ```bash
   curl -X POST http://localhost:3001/api/simulator/start
   ```

3. **Observer les logs backend** :
   Vous devriez voir :
   ```
   📊 Données simulées envoyées: moteur1 - Temp: 52.3°C
   🔍 Prédiction simulée: moteur1 - Normal (normal)
   🔍 Prédiction simulée: moteur2 - Overheating (critical)
   ```

### Étape 4: Test Frontend-Backend en Temps Réel

1. **Ouvrir le frontend** : `http://localhost:5173`

2. **Vérifier la connexion WebSocket** :
   - Ouvrir les outils développeur (F12)
   - Onglet Console
   - Chercher : `✅ Connected to WebSocket server`

3. **Observer les données en temps réel** :
   - Dashboard : Les cartes de moteurs doivent se mettre à jour
   - Graphiques : Doivent afficher les données simulées
   - Alertes : Les anomalies doivent apparaître

### Étape 5: Tests Spécifiques

#### Test 1: Données Brutes
- Naviguer vers "Motor Details" d'un moteur
- Onglet "Raw Data" : Vérifier l'affichage des graphiques temps réel
- Les données doivent se mettre à jour toutes les 100ms

#### Test 2: Prédictions
- Onglet "Predictions" : Observer les prédictions ML simulées
- Vérifier l'affichage des confidences XGBoost et CNN-LSTM
- Noter les changements d'état Normal → Anomalie

#### Test 3: Alertes
- Panel "Alerts" : Vérifier l'apparition des nouvelles anomalies
- Tester les filtres par sévérité
- Vérifier l'horodatage temps réel

#### Test 4: Métriques
- Dashboard : Observer les métriques qui se mettent à jour
- Température, vibration, efficacité doivent varier
- Statut des moteurs doit changer selon les anomalies

## 🔍 Tests Avancés

### Test de Charge WebSocket
```bash
# Terminal 1: Augmenter la fréquence de simulation
# Modifier backend/services/dataSimulator.js lignes 23-24:
# rawDataInterval: 50ms au lieu de 100ms
# predictionInterval: 1000ms au lieu de 2000-5000ms
```

### Test de Reconnexion
1. Arrêter le backend (`Ctrl+C`)
2. Observer le frontend : "Disconnected from WebSocket server"
3. Redémarrer le backend
4. Vérifier la reconnexion automatique

### Test API REST
```bash
# Test des anomalies
curl "http://localhost:3001/api/anomalies?limit=10"

# Test des prédictions
curl "http://localhost:3001/api/predictions?machineId=moteur1&limit=5"

# Test des données brutes
curl "http://localhost:3001/api/raw-data/moteur1?limit=20"
```

## 🎮 Contrôle du Simulateur

### Via API
```bash
# Arrêter
curl -X POST http://localhost:3001/api/simulator/stop

# Redémarrer
curl -X POST http://localhost:3001/api/simulator/start

# Statut
curl http://localhost:3001/api/simulator/status
```

### Via Code (backend/services/dataSimulator.js)
Modifier les paramètres de simulation :
- `intervalId` : Fréquence des données brutes
- `anomalyTypes` : Types d'anomalies générées
- Probabilités d'anomalies (ligne 66)

## ✅ Checklist de Validation

- [ ] Backend démarre sans erreur
- [ ] Base de données Supabase connectée
- [ ] Tables créées automatiquement
- [ ] Simulateur génère des données
- [ ] Frontend se connecte au WebSocket
- [ ] Données temps réel affichées
- [ ] Anomalies détectées et affichées
- [ ] API REST fonctionnelle
- [ ] Reconnexion automatique WebSocket
- [ ] Logs détaillés dans console backend

## 🐛 Dépannage

### Erreur de connexion Supabase
- Vérifier l'URL et les clés dans `.env`
- Tester la connexion depuis le dashboard Supabase

### WebSocket ne se connecte pas
- Vérifier CORS : `FRONTEND_URL=http://localhost:5173`
- Tester le port 3001 disponible

### Pas de données dans le frontend
- Vérifier les logs backend pour erreurs
- Inspecter Network tab (F12) pour requêtes échouées
- Vérifier la console pour erreurs JavaScript

## 🔄 Après Tests Réussis

Une fois tous les tests validés, vous pourrez :
1. Connecter le vrai Raspberry Pi
2. Remplacer le simulateur par les données MQTT réelles
3. Ajuster les seuils et algorithmes selon vos besoins

Le système est maintenant prêt pour la production ! 🎉