import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Motor } from '@/data/mockData';
import { AnomalyRecommendations } from './AnomalyRecommendations';
import { 
  AlertTriangle, 
  Activity, 
  Volume2, 
  Thermometer, 
  Settings,
  Calendar,
  Filter,
  Bell,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AlertsPanelProps {
  motors: Motor[];
  onRefresh?: () => void;
}

export const AlertsPanel = ({ motors }: AlertsPanelProps) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());

  // Collecter toutes les anomalies de tous les moteurs
  const allAnomalies = motors.flatMap(motor => 
    motor.anomalies.map(anomaly => ({
      ...anomaly,
      motorName: motor.name,
      motorLocation: motor.location
    }))
  );

  // Filtrer les anomalies selon les critères sélectionnés
  const filteredAnomalies = allAnomalies.filter(anomaly => {
    const severityMatch = selectedSeverity === 'all' || anomaly.severity === selectedSeverity;
    const typeMatch = selectedType === 'all' || anomaly.type === selectedType;
    return severityMatch && typeMatch;
  });

  // Trier par sévérité puis par date
  const sortedAnomalies = filteredAnomalies.sort((a, b) => {
    const severityOrder = { critical: 4, elevated: 3, warning: 2, normal: 1 };
    const severityDiff = severityOrder[b.severity as keyof typeof severityOrder] - 
                        severityOrder[a.severity as keyof typeof severityOrder];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'elevated': return 'secondary';
      case 'warning': return 'outline';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vibration': return <Activity className="h-4 w-4" />;
      case 'sound': return <Volume2 className="h-4 w-4" />;
      case 'temperature': return <Thermometer className="h-4 w-4" />;
      case 'imbalance': return <Settings className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `Il y a ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `Il y a ${diffHours}h`;
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  };

  const toggleAnomalyExpansion = (anomalyId: string) => {
    const newExpanded = new Set(expandedAnomalies);
    if (newExpanded.has(anomalyId)) {
      newExpanded.delete(anomalyId);
    } else {
      newExpanded.add(anomalyId);
    }
    setExpandedAnomalies(newExpanded);
  };

  // Statistiques des alertes
  const alertStats = {
    total: allAnomalies.length,
    critical: allAnomalies.filter(a => a.severity === 'critical').length,
    elevated: allAnomalies.filter(a => a.severity === 'elevated').length,
    warning: allAnomalies.filter(a => a.severity === 'warning').length,
    vibration: allAnomalies.filter(a => a.type === 'vibration').length,
    sound: allAnomalies.filter(a => a.type === 'sound').length,
    temperature: allAnomalies.filter(a => a.type === 'temperature').length,
    imbalance: allAnomalies.filter(a => a.type === 'imbalance').length,
  };

  return (
    <div className="space-y-6">
      {/* Statistiques des alertes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Bell className="h-4 w-4 mr-2" />
              Total Alertes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-severity-critical">
              Critiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-severity-critical">
              {alertStats.critical}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-severity-elevated">
              Élevées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-severity-elevated">
              {alertStats.elevated}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-severity-warning">
              Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-severity-warning">
              {alertStats.warning}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtres</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sévérité</label>
              <div className="flex gap-2">
                <Button
                  variant={selectedSeverity === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSeverity('all')}
                >
                  Toutes
                </Button>
                <Button
                  variant={selectedSeverity === 'critical' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSeverity('critical')}
                >
                  Critiques
                </Button>
                <Button
                  variant={selectedSeverity === 'elevated' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSeverity('elevated')}
                >
                  Élevées
                </Button>
                <Button
                  variant={selectedSeverity === 'warning' ? 'outline' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSeverity('warning')}
                >
                  Attention
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="flex gap-2">
                <Button
                  variant={selectedType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('all')}
                >
                  Tous
                </Button>
                <Button
                  variant={selectedType === 'vibration' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('vibration')}
                >
                  Vibration
                </Button>
                <Button
                  variant={selectedType === 'sound' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('sound')}
                >
                  Son
                </Button>
                <Button
                  variant={selectedType === 'temperature' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('temperature')}
                >
                  Température
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des alertes */}
      <Card>
        <CardHeader>
          <CardTitle>
            Alertes Actives ({filteredAnomalies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedAnomalies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune alerte ne correspond aux filtres sélectionnés
              </div>
            ) : (
              sortedAnomalies.map((anomaly) => {
                const anomalyKey = `${anomaly.motorId}-${anomaly.id}`;
                const isExpanded = expandedAnomalies.has(anomalyKey);
                
                return (
                  <div key={anomalyKey} className="space-y-3">
                    <Alert className="border-l-4 border-l-primary">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getTypeIcon(anomaly.type)}
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <AlertTitle className="text-base font-semibold">
                                {anomaly.description}
                              </AlertTitle>
                              <div className="flex items-center space-x-2">
                                <Badge variant={getSeverityBadgeVariant(anomaly.severity)}>
                                  {anomaly.severity}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleAnomalyExpansion(anomalyKey)}
                                  className="h-6 w-6 p-0"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <AlertDescription>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-4 text-sm">
                                  <span><strong>Moteur:</strong> {anomaly.motorName}</span>
                                  <span><strong>Localisation:</strong> {anomaly.motorLocation}</span>
                                </div>
                                <div className="flex items-center space-x-4 text-sm">
                                  <span><strong>Valeur:</strong> {anomaly.value}
                                    {anomaly.type === 'temperature' ? '°C' : 
                                     anomaly.type === 'sound' ? 'dB' : ''}
                                  </span>
                                  <span><strong>Seuil:</strong> {anomaly.threshold}
                                    {anomaly.type === 'temperature' ? '°C' : 
                                     anomaly.type === 'sound' ? 'dB' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  <span>{formatDateTime(anomaly.detectedAt)}</span>
                                </div>
                              </div>
                            </AlertDescription>
                          </div>
                        </div>
                      </div>
                    </Alert>
                    
                    {isExpanded && (
                      <AnomalyRecommendations 
                        anomalyType={anomaly.type}
                        severity={anomaly.severity}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
