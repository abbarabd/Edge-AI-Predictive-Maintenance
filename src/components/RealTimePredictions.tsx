/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
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
import { useToast, toast } from "@/hooks/use-toast";


interface Prediction {
  type: string;
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

  useEffect(() => {
    loadPredictions();
    loadStats();

    // Écouter les nouvelles prédictions en temps réel
    websocketService.onPredictionUpdate((data: any) => {
      const newPrediction = data.prediction as Prediction;
      
      // Mettre à jour la dernière prédiction
      setLatestPrediction(newPrediction);
      
      // Ajouter à la liste des prédictions
      setPredictions(prev => [newPrediction, ...prev.slice(0, 9)]); // Garder les 10 dernières
      
      // Afficher un toast pour les anomalies
      if (newPrediction.type !== 'Normal') {
        toast({
          title: "🔮 Nouvelle prédiction",
          description: `${newPrediction.type} détecté avec ${(newPrediction.confidence * 100).toFixed(1)}% de confiance`,
          variant: newPrediction.severity === 'critical' ? 'destructive' : 'default'
        });
      }
    });

    return () => {
      websocketService.off('predictionUpdate');
    };
  }, [machineId]);

  const loadPredictions = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getPredictions(machineId, 10) as Prediction[];
      setPredictions(data);
      
      if (data && data.length > 0) {
        setLatestPrediction(data[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des prédictions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les prédictions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await apiService.getPredictionStats(machineId);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  };

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

  if (isLoading) {
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
              <Badge variant={getSeverityBadgeVariant(latestPrediction.severity)}>
                {latestPrediction.prediction_type}
              </Badge>
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
              <Button variant="outline" size="sm" onClick={loadPredictions}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques des prédictions */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold mt-2">{stats.total}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Confiance Moyenne</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {(stats.averageConfidence.overall * 100).toFixed(1)}%
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
                {(stats.averageConfidence.xgb * 100).toFixed(1)}%
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
                {(stats.averageConfidence.dl * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historique des prédictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Historique des Prédictions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {predictions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune prédiction disponible
              </div>
            ) : (
              predictions.map((prediction, index) => (
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