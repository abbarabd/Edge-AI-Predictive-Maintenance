import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { Motor } from '@/types/motor';
import { 
  Activity, 
  Volume2, 
  Thermometer, 
  AlertTriangle,
  Eye,
  Settings
} from 'lucide-react';

interface MotorCardProps {
  motor: Motor;
  onSelect: () => void;
}

export const MotorCard = ({ motor, onSelect }: MotorCardProps) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'normal': return 'text-severity-normal';
      case 'warning': return 'text-severity-warning';
      case 'elevated': return 'text-severity-elevated';
      case 'critical': return 'text-severity-critical';
      default: return 'text-muted-foreground';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <div className="h-2 w-2 bg-accent rounded-full animate-pulse" />;
      case 'stopped': return <div className="h-2 w-2 bg-muted rounded-full" />;
      case 'maintenance': return <Settings className="h-4 w-4 text-severity-warning" />;
      default: return null;
    }
  };

  const getLatestValue = (data: { value: number }[]) => {
    return data.length > 0 ? data[data.length - 1].value : 0;
  };

  const criticalAnomalies = motor.anomalies.filter(a => a.severity === 'critical').length;
  const elevatedAnomalies = motor.anomalies.filter(a => a.severity === 'elevated').length;

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{motor.name}</CardTitle>
          <div className="flex items-center space-x-2">
            {getStatusIcon(motor.status)}
            <Badge variant={getSeverityBadgeVariant(motor.overallSeverity)}>
              {motor.overallSeverity}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{motor.location}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Métriques de capteurs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <Activity className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-sm font-medium">{getLatestValue(motor.vibrationData).toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Vibration</div>
          </div>
          <div className="text-center">
            <Volume2 className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-sm font-medium">{getLatestValue(motor.soundData).toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Son (dB)</div>
          </div>
          <div className="text-center">
            <Thermometer className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-sm font-medium">{getLatestValue(motor.temperatureData).toFixed(1)}°C</div>
            <div className="text-xs text-muted-foreground">Temp.</div>
          </div>
        </div>

        {/* Alertes */}
        {motor.anomalies.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1 text-severity-warning" />
                Anomalies détectées
              </span>
              <span className="text-sm text-muted-foreground">
                {motor.anomalies.length}
              </span>
            </div>
            
            {criticalAnomalies > 0 && (
              <div className="text-xs text-severity-critical">
                • {criticalAnomalies} critique(s)
              </div>
            )}
            {elevatedAnomalies > 0 && (
              <div className="text-xs text-severity-elevated">
                • {elevatedAnomalies} élevée(s)
              </div>
            )}
          </div>
        )}

        {/* État de santé général */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>État de santé</span>
            <span className={getSeverityColor(motor.overallSeverity)}>
              {motor.overallSeverity === 'normal' ? 'Normal' : 
               motor.overallSeverity === 'warning' ? 'Attention' :
               motor.overallSeverity === 'elevated' ? 'Élevé' : 'Critique'}
            </span>
          </div>
          <Progress 
            value={
              motor.overallSeverity === 'normal' ? 90 :
              motor.overallSeverity === 'warning' ? 70 :
              motor.overallSeverity === 'elevated' ? 40 : 15
            } 
            className="h-2"
          />
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSelect} 
          className="w-full mt-4"
        >
          <Eye className="h-4 w-4 mr-2" />
          Voir les détails
        </Button>
      </CardContent>
    </Card>
  );
};