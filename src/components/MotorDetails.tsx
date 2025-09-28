/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Motor } from '@/types/motor';
import { SensorChart } from './SensorChart';
import { AnomalyRecommendations } from './AnomalyRecommendations';
import { RawDataVisualization } from './RawDataVisualization';
import { RealTimePredictions } from './RealTimePredictions';
import { 
  Activity, 
  Volume2, 
  Thermometer, 
  AlertTriangle,
  Settings,
  MapPin,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface MotorDetailsProps {
  motor: Motor;
}

export const MotorDetails = ({ motor }: MotorDetailsProps) => {
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
      case 'running': return <div className="h-3 w-3 bg-accent rounded-full animate-pulse" />;
      case 'stopped': return <div className="h-3 w-3 bg-muted rounded-full" />;
      case 'maintenance': return <Settings className="h-5 w-5 text-severity-warning" />;
      default: return null;
    }
  };

  const getLatestValue = (data: { value: number }[]) => {
    return data.length > 0 ? data[data.length - 1].value : 0;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  return (
    <div className="space-y-6">
      {/* En-tête du moteur */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center space-x-3">
                {getStatusIcon(motor.status)}
                <span>{motor.name}</span>
              </CardTitle>
              <div className="flex items-center space-x-4 mt-2 text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{motor.location}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Settings className="h-4 w-4" />
                  <span>ID: {motor.id}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge 
                variant={getSeverityBadgeVariant(motor.overallSeverity)}
                className="text-sm px-3 py-1"
              >
                {motor.overallSeverity === 'normal' ? 'Normal' : 
                 motor.overallSeverity === 'warning' ? 'Attention' :
                 motor.overallSeverity === 'elevated' ? 'Élevé' : 'Critique'}
              </Badge>
              <div className="text-sm text-muted-foreground mt-1">
                État: {motor.status === 'running' ? 'En fonctionnement' : 
                      motor.status === 'stopped' ? 'Arrêté' : 'En maintenance'}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Valeurs actuelles des capteurs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Activity className="h-5 w-5 text-primary" />
              <span>Vibrations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">
              {getLatestValue(motor.vibrationData).toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              Unités relatives • Seuil: 2
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 mr-1 text-accent" />
              <span className="text-sm text-accent">Tendance stable</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Volume2 className="h-5 w-5 text-primary" />
              <span>Niveau Sonore</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">
              {getLatestValue(motor.soundData).toFixed(1)} dB
            </div>
            <div className="text-sm text-muted-foreground">
              Décibels • Seuil: 2500 dB
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 mr-1 text-accent" />
              <span className="text-sm text-accent">Dans les normes</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Thermometer className="h-5 w-5 text-primary" />
              <span>Température</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">
              {getLatestValue(motor.temperatureData).toFixed(1)}°C
            </div>
            <div className="text-sm text-muted-foreground">
              Celsius • Seuil: 55°C
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 mr-1 text-accent" />
              <span className="text-sm text-accent">Température normale</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques des capteurs */}
      <Tabs defaultValue="vibration" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vibration">Vibrations</TabsTrigger>
          <TabsTrigger value="sound">Niveau Sonore</TabsTrigger>
          <TabsTrigger value="temperature">Température</TabsTrigger>
          <TabsTrigger value="rawdata">Données Brutes</TabsTrigger>
          <TabsTrigger value="predictions">Prédictions IA</TabsTrigger>
        </TabsList>

        <TabsContent value="vibration">
          <SensorChart 
            data={motor.vibrationData}
            title="Évolution des Vibrations"
            color="hsl(217 91% 60%)"
            unit=""
            threshold={50}
          />
        </TabsContent>

        <TabsContent value="sound">
          <SensorChart 
            data={motor.soundData}
            title="Évolution du Niveau Sonore"
            color="hsl(142 76% 36%)"
            unit="dB"
            threshold={60}
          />
        </TabsContent>

        <TabsContent value="temperature">
          <SensorChart 
            data={motor.temperatureData}
            title="Évolution de la Température"
            color="hsl(0 84% 60%)"
            unit="°C"
            threshold={75}
          />
        </TabsContent>

      <TabsContent value="rawdata">
  <RawDataVisualization 
    data={(motor.rawSensorData as any[]).map((item) => ({
      _id: item._id,
      machine_id: item.machineId ?? item.machine_id, 
      timestamp_rpi: item.timestamp_rpi,
      temperature_c: item.temperature_c,
      accel_x_g: item.accel_x_g,
      accel_y_g: item.accel_y_g,
      accel_z_g: item.accel_z_g,
      raw_sound_analog: item.raw_sound_analog,
      sound_amplitude: item.soundAmplitude ?? item.sound_amplitude,
      fault_type: item.fault_type,
      __v: item.__v
    }))}
    machineId={motor.id}
  />
</TabsContent>



        <TabsContent value="predictions">
          <RealTimePredictions machineId={motor.id} />
        </TabsContent>
      </Tabs>

      {/* Anomalies détectées */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-severity-warning" />
            <span>Anomalies Détectées ({motor.anomalies.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {motor.anomalies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune anomalie détectée pour ce moteur
              </div>
            ) : (
              motor.anomalies.map((anomaly) => (
                <div key={anomaly.id} className="space-y-3">
                  <Alert className="border-l-4 border-l-primary">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="flex items-center justify-between">
                      <span>{anomaly.description}</span>
                      <Badge variant={getSeverityBadgeVariant(anomaly.severity)}>
                        {anomaly.severity}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Type:</span> {anomaly.type}
                        </div>
                        <div>
                          <span className="font-medium">Valeur:</span> {anomaly.value} 
                          {anomaly.type === 'temperature' ? '°C' : anomaly.type === 'sound' ? 'dB' : ''}
                        </div>
                        <div>
                          <span className="font-medium">Seuil:</span> {anomaly.threshold}
                          {anomaly.type === 'temperature' ? '°C' : anomaly.type === 'sound' ? 'dB' : ''}
                        </div>
                      </div>
                      <div className="flex items-center mt-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>Détectée le {formatDateTime(anomaly.detectedAt)}</span>
                      </div>
                    </AlertDescription>
                  </Alert>
                  
                  <AnomalyRecommendations 
                    anomalyType={anomaly.type}
                    severity={anomaly.severity}
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
