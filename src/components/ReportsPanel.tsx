import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { Motor } from '@/data/mockData';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';

interface ReportsPanelProps {
  motors: Motor[];
}

export const ReportsPanel = ({ motors }: ReportsPanelProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('week');

  // Calculer les statistiques globales
  const totalAnomalies = motors.reduce((sum, motor) => sum + motor.anomalies.length, 0);
  const criticalAnomalies = motors.reduce((sum, motor) => 
    sum + motor.anomalies.filter(a => a.severity === 'critical').length, 0);
  const motorsByStatus = {
    running: motors.filter(m => m.status === 'running').length,
    maintenance: motors.filter(m => m.status === 'maintenance').length,
    stopped: motors.filter(m => m.status === 'stopped').length
  };

  // Analyse des tendances
  const getMotorHealthScore = (motor: Motor) => {
    const severityWeights = { normal: 100, warning: 75, elevated: 50, critical: 25 };
    return severityWeights[motor.overallSeverity as keyof typeof severityWeights] || 0;
  };

  const averageHealthScore = motors.reduce((sum, motor) => 
    sum + getMotorHealthScore(motor), 0) / motors.length;

  const motorReports = motors.map(motor => {
    const healthScore = getMotorHealthScore(motor);
    const anomaliesByType = {
      vibration: motor.anomalies.filter(a => a.type === 'vibration').length,
      sound: motor.anomalies.filter(a => a.type === 'sound').length,
      temperature: motor.anomalies.filter(a => a.type === 'temperature').length,
      imbalance: motor.anomalies.filter(a => a.type === 'imbalance').length
    };

    const latestValues = {
      vibration: motor.vibrationData[motor.vibrationData.length - 1]?.value || 0,
      sound: motor.soundData[motor.soundData.length - 1]?.value || 0,
      temperature: motor.temperatureData[motor.temperatureData.length - 1]?.value || 0
    };

    return {
      ...motor,
      healthScore,
      anomaliesByType,
      latestValues,
      trend: healthScore > 75 ? 'stable' : healthScore > 50 ? 'declining' : 'critical'
    };
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'elevated': return 'secondary';
      case 'warning': return 'outline';
      default: return 'default';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'stable': return <CheckCircle className="h-4 w-4 text-severity-normal" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-severity-warning" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-severity-critical" />;
      default: return <TrendingUp className="h-4 w-4 text-accent" />;
    }
  };

  const reportTypes = [
    {
      id: 'weekly',
      title: 'Rapport Hebdomadaire',
      description: 'Analyse des performances sur 7 jours',
      icon: BarChart3
    },
    {
      id: 'monthly',
      title: 'Rapport Mensuel',
      description: 'Synthèse des tendances sur 30 jours',
      icon: PieChart
    },
    {
      id: 'maintenance',
      title: 'Rapport de Maintenance',
      description: 'Recommandations et planification',
      icon: Activity
    }
  ];

  return (
    <div className="space-y-6">
      {/* Résumé exécutif */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Résumé Exécutif - Maintenance Prédictive</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold">État Global du Parc</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Score de santé moyen</span>
                  <span className="font-medium">{Math.round(averageHealthScore)}%</span>
                </div>
                <Progress value={averageHealthScore} className="h-2" />
                <div className="text-sm text-muted-foreground">
                  {averageHealthScore > 80 ? 'Excellent' : 
                   averageHealthScore > 60 ? 'Bon' : 
                   averageHealthScore > 40 ? 'Moyen' : 'Critique'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Alertes Actives</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total</span>
                  <Badge variant="outline">{totalAnomalies}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Critiques</span>
                  <Badge variant="destructive">{criticalAnomalies}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Nécessitent une action</span>
                  <Badge variant="secondary">
                    {motors.filter(m => m.overallSeverity === 'elevated' || m.overallSeverity === 'critical').length}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">État des Équipements</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center">
                    <div className="h-2 w-2 bg-accent rounded-full mr-2" />
                    En fonctionnement
                  </span>
                  <span className="font-medium">{motorsByStatus.running}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center">
                    <div className="h-2 w-2 bg-severity-warning rounded-full mr-2" />
                    En maintenance
                  </span>
                  <span className="font-medium">{motorsByStatus.maintenance}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center">
                    <div className="h-2 w-2 bg-muted rounded-full mr-2" />
                    Arrêtés
                  </span>
                  <span className="font-medium">{motorsByStatus.stopped}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sélection de période */}
      <Card>
        <CardHeader>
          <CardTitle>Période d'Analyse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {['week', 'month', 'quarter'].map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
              >
                {period === 'week' ? 'Semaine' : 
                 period === 'month' ? 'Mois' : 'Trimestre'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rapports détaillés par moteur */}
      <Card>
        <CardHeader>
          <CardTitle>Rapport Détaillé par Équipement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {motorReports.map((motor) => (
              <div key={motor.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{motor.name}</h3>
                    <p className="text-sm text-muted-foreground">{motor.location}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(motor.trend)}
                    <Badge variant={getSeverityBadgeVariant(motor.overallSeverity)}>
                      Score: {motor.healthScore}%
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Anomalies par Type</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Vibrations:</span>
                        <span>{motor.anomaliesByType.vibration}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Son:</span>
                        <span>{motor.anomaliesByType.sound}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Température:</span>
                        <span>{motor.anomaliesByType.temperature}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Déséquilibre:</span>
                        <span>{motor.anomaliesByType.imbalance}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Valeurs Actuelles</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Vibration:</span>
                        <span>{motor.latestValues.vibration.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Son:</span>
                        <span>{motor.latestValues.sound.toFixed(1)} dB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Température:</span>
                        <span>{motor.latestValues.temperature.toFixed(1)}°C</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Recommandations</h4>
                    <div className="space-y-1 text-muted-foreground">
                      {motor.overallSeverity === 'critical' && (
                        <div className="text-severity-critical">• Arrêt immédiat requis</div>
                      )}
                      {motor.overallSeverity === 'elevated' && (
                        <div className="text-severity-elevated">• Maintenance préventive</div>
                      )}
                      {motor.overallSeverity === 'warning' && (
                        <div className="text-severity-warning">• Surveillance renforcée</div>
                      )}
                      {motor.overallSeverity === 'normal' && (
                        <div className="text-severity-normal">• Fonctionnement normal</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Types de rapports disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>Rapports Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportTypes.map((report) => {
              const Icon = report.icon;
              return (
                <div key={report.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{report.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger PDF
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};