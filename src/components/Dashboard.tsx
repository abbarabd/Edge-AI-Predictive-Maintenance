import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
//import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { mockMotors, systemMetrics, type Motor } from '@/data/mockData';
import { MotorCard } from './MotorCard';
import { MotorDetails } from './MotorDetails';
import { AlertsPanel } from './AlertsPanel';
import { ReportsPanel } from './ReportsPanel';
import { 
  Activity, 
  AlertTriangle, 
  Settings, 
  Thermometer, 
  Volume2, 
  Zap,
  TrendingUp,
  Eye
} from 'lucide-react';

const Dashboard = () => {
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [activeTab, setActiveTab] = useState('overview');


  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'elevated': return 'secondary';
      case 'warning': return 'outline';
      default: return 'default';
    }
  };

  if (selectedMotor && activeTab === 'motors') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setSelectedMotor(null)}
            className="mb-4"
          >
            ← Retour à la vue d'ensemble
          </Button>
        </div>
        <MotorDetails motor={selectedMotor} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Dashboard Maintenance Prédictive
              </h1>
              <p className="text-muted-foreground mt-1">
                Surveillance en temps réel des équipements industriels
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Dernière mise à jour</div>
                <div className="text-sm font-medium">{new Date().toLocaleTimeString()}</div>
              </div>
              <div className="h-3 w-3 bg-accent rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="motors">Moteurs</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Métriques globales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Moteurs Actifs</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemMetrics.totalMotors}</div>
                  <p className="text-xs text-muted-foreground">
                    {mockMotors.filter(m => m.status === 'running').length} en fonctionnement
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-severity-warning">
                    {systemMetrics.activeAlerts}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {systemMetrics.criticalMotors} critiques
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Efficacité Système</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">
                    {systemMetrics.systemEfficiency}%
                  </div>
                  <Progress 
                    value={systemMetrics.systemEfficiency} 
                    className="mt-2 h-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-severity-elevated">
                    {systemMetrics.maintenanceRequired}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Interventions requises
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Moyennes des capteurs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>Vibrations Moyennes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{systemMetrics.averageVibration}</div>
                  <Progress value={systemMetrics.averageVibration} className="h-3" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Seuil critique: 80
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Volume2 className="h-5 w-5 text-primary" />
                    <span>Niveau Sonore Moyen</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{systemMetrics.averageSound}</div>
                  <Progress value={systemMetrics.averageSound} className="h-3" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Seuil critique: 85
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Thermometer className="h-5 w-5 text-primary" />
                    <span>Température Moyenne</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{systemMetrics.averageTemperature}°C</div>
                  <Progress value={systemMetrics.averageTemperature} className="h-3" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Seuil critique: 85°C
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* État des moteurs */}
            <Card>
              <CardHeader>
                <CardTitle>État des Moteurs par Sévérité</CardTitle>
                <CardDescription>
                  Vue d'ensemble de tous les moteurs et de leur niveau d'anomalie
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockMotors.map((motor) => (
                    <div
                      key={motor.id}
                      className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedMotor(motor);
                        setActiveTab('motors');
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{motor.name}</h3>
                        <Badge variant={getSeverityBadgeVariant(motor.overallSeverity)}>
                          {motor.overallSeverity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{motor.location}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {motor.anomalies.length} anomalie(s)
                        </span>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="motors" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {mockMotors.map((motor) => (
                <MotorCard
                  key={motor.id}
                  motor={motor}
                  onSelect={() => setSelectedMotor(motor)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsPanel motors={mockMotors} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsPanel motors={mockMotors} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;