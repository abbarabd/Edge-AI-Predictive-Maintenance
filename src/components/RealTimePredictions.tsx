/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  Activity, 
  Clock, 
  TrendingUp,
  RefreshCw,
  Zap
} from 'lucide-react';
import websocketService from '@/services/websocketService';
import apiService from '@/services/apiService';
import { toast } from '@/components/ui/use-toast';

interface Prediction {
  id: string;
  machine_id: string;
  prediction_type: string;
  confidence: number;
  severity: string;
  timestamp: string;
  xgb_prediction: string;
  xgb_confidence: number;
  dl_prediction: string;
  dl_confidence: number;
  raw_data_sample?: any;
}

interface RealTimePredictionsProps {
  machineId?: string;
}

export const RealTimePredictions = ({ machineId }: RealTimePredictionsProps) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [latestPrediction, setLatestPrediction] = useState<Prediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Utiliser useRef pour éviter les dépendances cycliques
  const loadingRef = useRef(false);
  const lastLoadTime = useRef(0);
  const MINIMUM_LOAD_INTERVAL = 5000; // 5 secondes minimum entre les rechargements

  // Fonction de chargement des statistiques avec throttling
  const loadStats = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Éviter les rechargements trop fréquents
    if (!force && (now - lastLoadTime.current) < MINIMUM_LOAD_INTERVAL) {
      console.log('⏳ Chargement stats ignoré - trop récent');
      return;
    }

    if (loadingRef.current) {
      console.log('⏳ Chargement stats déjà en cours');
      return;
    }

    try {
      loadingRef.current = true;
      lastLoadTime.current = now;

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const queryParams = machineId ? `?machineId=${machineId}` : '';
      
      console.log(`📊 Chargement des stats depuis: ${baseUrl}/api/predictions/stats${queryParams}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout 10s

      const response = await fetch(`${baseUrl}/api/predictions/stats${queryParams}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const statsData = await response.json();
      console.log('📊 Statistiques reçues:', statsData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques:', error);
      if (error.name !== 'AbortError') {
        // Ne pas afficher de toast pour chaque erreur
        console.warn('Stats non disponibles - utilisation des données temps réel uniquement');
      }
    } finally {
      loadingRef.current = false;
    }
  }, [machineId]);

  // Fonction de chargement des prédictions avec throttling
  const loadPredictions = useCallback(async (force = false) => {
    const now = Date.now();
    
    if (!force && (now - lastLoadTime.current) < MINIMUM_LOAD_INTERVAL) {
      console.log('⏳ Chargement prédictions ignoré - trop récent');
      return;
    }

    if (loadingRef.current && !force) {
      console.log('⏳ Chargement prédictions déjà en cours');
      return;
    }

    try {
      setIsLoading(true);
      console.log(`🔮 Chargement des prédictions pour ${machineId || 'tous les moteurs'}`);
      
      const data = await apiService.getPredictions(machineId, 10) as Prediction[];
      setPredictions(data || []);
      
      if (data && data.length > 0) {
        setLatestPrediction(data[0]);
        console.log('✅ Prédictions chargées:', data.length);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des prédictions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les prédictions. Utilisation des données temps réel uniquement.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [machineId]);

  // Chargement initial - une seule fois
  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      if (!mounted) return;
      
      console.log('🔄 Initialisation des données RealTimePredictions');
      await loadPredictions(true);
      
      if (!mounted) return;
      
      // Attendre un peu avant de charger les stats pour éviter la surcharge
      setTimeout(() => {
        if (mounted) {
          loadStats(true);
        }
      }, 2000);
    };

    initializeData();

    return () => {
      mounted = false;
    };
  }, [machineId]); // SEULEMENT machineId comme dépendance

  // WebSocket listeners - séparés du chargement initial
  useEffect(() => {
    // Écouter les nouvelles prédictions en temps réel
    const handleNewPrediction = (data: any) => {
      console.log('🔮 Nouvelle prédiction reçue:', data);
      
      const newPrediction: Prediction = {
        id: data.id || `${Date.now()}`,
        machine_id: data.machine_id || data.machineId,
        prediction_type: data.prediction_type || data.type,
        confidence: data.confidence || 0,
        severity: data.severity,
        timestamp: data.timestamp,
        xgb_prediction: data.xgb_prediction,
        xgb_confidence: data.xgb_confidence || 0,
        dl_prediction: data.dl_prediction,
        dl_confidence: data.dl_confidence || 0,
        raw_data_sample: data.raw_data_sample
      };
      
      // Filtrer par machine si spécifié
      if (!machineId || newPrediction.machine_id === machineId) {
        console.log('✅ Ajout de la nouvelle prédiction à la liste');
        setLatestPrediction(newPrediction);
        setPredictions(prev => [newPrediction, ...prev.slice(0, 9)]); // Garder 10 max
        
        // Toast uniquement pour les anomalies importantes
        if (newPrediction.prediction_type !== 'Normal' && newPrediction.severity !== 'normal') {
          toast({
            title: "🔮 Nouvelle prédiction",
            description: `${newPrediction.prediction_type} détecté avec ${(newPrediction.confidence * 100).toFixed(1)}% de confiance`,
            variant: newPrediction.severity === 'critical' ? 'destructive' : 'default'
          });
        }
        
        // Recharger les stats seulement si c'est une anomalie significative
        if (newPrediction.prediction_type !== 'Normal') {
          setTimeout(() => loadStats(false), 3000); // Délai pour éviter surcharge
        }
      }
    };

    websocketService.onNewPrediction(handleNewPrediction);

    // Pas de cleanup nécessaire - géré par websocketService
    return () => {};
  }, [machineId, loadStats]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadPredictions(true),
        loadStats(true)
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadPredictions, loadStats]);

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'elevated': return 'secondary';
      case 'warning': return 'outline';
      default: return 'default';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-accent';
    if (confidence >= 0.7) return 'text-primary';
    if (confidence >= 0.5) return 'text-severity-warning';
    return 'text-severity-critical';
  };

  // Affichage conditionnel pour éviter les rendus multiples
  if (isLoading && !predictions.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Prédictions en Temps Réel</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Chargement des prédictions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dernière prédiction - Vue d'ensemble */}
      {latestPrediction && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <span>Dernière Prédiction</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getSeverityBadgeVariant(latestPrediction.severity)}>
                  {latestPrediction.prediction_type}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">XGBoost</h4>
                <div className="flex items-center space-x-2">
                  <span className="font-bold">{latestPrediction.xgb_prediction}</span>
                  <span className={`text-sm ${getConfidenceColor(latestPrediction.xgb_confidence)}`}>
                    {(latestPrediction.xgb_confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">CNN-LSTM</h4>
                <div className="flex items-center space-x-2">
                  <span className="font-bold">{latestPrediction.dl_prediction}</span>
                  <span className={`text-sm ${getConfidenceColor(latestPrediction.dl_confidence)}`}>
                    {(latestPrediction.dl_confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Prédiction Finale</h4>
                <div className="flex items-center space-x-2">
                  <span className="font-bold">{latestPrediction.prediction_type}</span>
                  <span className={`text-sm ${getConfidenceColor(latestPrediction.confidence)}`}>
                    {(latestPrediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatDateTime(latestPrediction.timestamp)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques des prédictions - Seulement si disponibles */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold mt-2">{stats.total || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Confiance Moyenne</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {stats.averageConfidence ? (stats.averageConfidence.overall * 100).toFixed(1) + '%' : '0%'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">XGB Moy.</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {stats.averageConfidence ? (stats.averageConfidence.xgb * 100).toFixed(1) + '%' : '0%'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">DL Moy.</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {stats.averageConfidence ? (stats.averageConfidence.dl * 100).toFixed(1) + '%' : '0%'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Message si pas de stats */}
      {!stats && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>Statistiques en cours de chargement...</p>
            <p className="text-sm mt-2">Les prédictions temps réel sont disponibles ci-dessous</p>
          </CardContent>
        </Card>
      )}

      {/* Historique des prédictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Historique des Prédictions</span>
            <Badge variant="secondary">{predictions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {predictions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucune prédiction disponible</p>
                <p className="text-sm mt-1">Les nouvelles prédictions apparaîtront automatiquement</p>
              </div>
            ) : (
              predictions.slice(0, 10).map((prediction, index) => (
                <div 
                  key={prediction.id || index} 
                  className={`p-4 rounded-lg border ${
                    index === 0 ? 'bg-muted/50' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={getSeverityBadgeVariant(prediction.severity)}>
                        {prediction.prediction_type}
                      </Badge>
                      <span className={`text-sm font-medium ${getConfidenceColor(prediction.confidence)}`}>
                        {(prediction.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(prediction.timestamp)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">XGBoost: </span>
                      <span className="font-medium">{prediction.xgb_prediction}</span>
                      <span className={`ml-1 ${getConfidenceColor(prediction.xgb_confidence)}`}>
                        ({(prediction.xgb_confidence * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CNN-LSTM: </span>
                      <span className="font-medium">{prediction.dl_prediction}</span>
                      <span className={`ml-1 ${getConfidenceColor(prediction.dl_confidence)}`}>
                        ({(prediction.dl_confidence * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};