// components/ThresholdSettings.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import apiService from '@/services/apiService';
import type { Motor } from '@/types/motor';

interface ThresholdConfig {
  temperature: { warning: number; critical: number };
  vibration: { warning: number; critical: number };
  sound: { warning: number; critical: number };
}

interface ThresholdSettingsProps {
  motors: Motor[];
  onThresholdsUpdate?: (thresholds: ThresholdConfig) => void;
}

const ThresholdSettings = ({ motors, onThresholdsUpdate }: ThresholdSettingsProps) => {
  const [globalThresholds, setGlobalThresholds] = useState<ThresholdConfig>({
    temperature: { warning: 35, critical: 40 },
    vibration: { warning: 1.2, critical: 1.8 },
    sound: { warning: 0.8, critical: 1.0 }
  });
  
  const [originalThresholds, setOriginalThresholds] = useState<ThresholdConfig>(globalThresholds);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [motorThresholds, setMotorThresholds] = useState<ThresholdConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadGlobalThresholds();
  }, []);

  useEffect(() => {
    // Vérifier s'il y a des changements
    const changed = JSON.stringify(globalThresholds) !== JSON.stringify(originalThresholds);
    setHasChanges(changed);
  }, [globalThresholds, originalThresholds]);

  const loadGlobalThresholds = async () => {
    try {
      setIsLoading(true);
      const thresholds = await apiService.getGlobalThresholds();
      setGlobalThresholds(thresholds);
      setOriginalThresholds(thresholds);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors du chargement des seuils globaux' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMotorThresholds = async (motor: Motor) => {
    try {
      setIsLoading(true);
      const thresholds = await apiService.getMotorThresholds(motor.id);
      setMotorThresholds(thresholds.thresholds);
      setSelectedMotor(motor);
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur lors du chargement des seuils pour ${motor.name}` });
      // Utiliser les seuils globaux par défaut
      setMotorThresholds(globalThresholds);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGlobalThresholds = async () => {
    try {
      setIsSaving(true);
      await apiService.updateGlobalThresholds(globalThresholds);
      setOriginalThresholds(globalThresholds);
      setMessage({ type: 'success', text: 'Seuils globaux sauvegardés avec succès' });
      onThresholdsUpdate?.(globalThresholds);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des seuils globaux' });
    } finally {
      setIsSaving(false);
    }
  };

  const saveMotorThresholds = async () => {
    if (!selectedMotor || !motorThresholds) return;

    try {
      setIsSaving(true);
      await apiService.updateMotorThresholds(selectedMotor.id, motorThresholds);
      setMessage({ type: 'success', text: `Seuils sauvegardés pour ${selectedMotor.name}` });
    } catch (error) {
      setMessage({ type: 'error', text: `Erreur lors de la sauvegarde pour ${selectedMotor.name}` });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefault = () => {
    setGlobalThresholds(originalThresholds);
  };

  const updateGlobalThreshold = (sensor: keyof ThresholdConfig, level: 'warning' | 'critical', value: number) => {
    setGlobalThresholds(prev => ({
      ...prev,
      [sensor]: {
        ...prev[sensor],
        [level]: value
      }
    }));
  };

  const updateMotorThreshold = (sensor: keyof ThresholdConfig, level: 'warning' | 'critical', value: number) => {
    if (!motorThresholds) return;
    
    setMotorThresholds(prev => ({
      ...prev!,
      [sensor]: {
        ...prev![sensor],
        [level]: value
      }
    }));
  };

  const validateThreshold = (sensor: keyof ThresholdConfig, thresholds: ThresholdConfig): boolean => {
    return thresholds[sensor].warning < thresholds[sensor].critical;
  };

  const ThresholdInputs = ({ 
    thresholds, 
    onUpdate, 
    prefix = '' 
  }: { 
    thresholds: ThresholdConfig; 
    onUpdate: (sensor: keyof ThresholdConfig, level: 'warning' | 'critical', value: number) => void;
    prefix?: string;
  }) => (
    <div className="space-y-6">
      {Object.entries(thresholds).map(([sensor, values]) => {
        const sensorKey = sensor as keyof ThresholdConfig;
        const isValid = validateThreshold(sensorKey, thresholds);
        
        return (
          <div key={sensor} className="space-y-4">
            <div className="flex items-center space-x-2">
              <Label className="text-base font-medium capitalize">{sensor}</Label>
              {!isValid && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Seuils invalides
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`${prefix}${sensor}-warning`} className="text-sm text-muted-foreground">
                  Seuil d'alerte
                </Label>
                <Input
                  id={`${prefix}${sensor}-warning`}
                  type="number"
                  step="0.1"
                  min="0"
                  value={values.warning}
                  onChange={(e) => onUpdate(sensorKey, 'warning', parseFloat(e.target.value) || 0)}
                  className={!isValid ? 'border-destructive' : ''}
                />
              </div>
              
              <div>
                <Label htmlFor={`${prefix}${sensor}-critical`} className="text-sm text-muted-foreground">
                  Seuil critique
                </Label>
                <Input
                  id={`${prefix}${sensor}-critical`}
                  type="number"
                  step="0.1"
                  min="0"
                  value={values.critical}
                  onChange={(e) => onUpdate(sensorKey, 'critical', parseFloat(e.target.value) || 0)}
                  className={!isValid ? 'border-destructive' : ''}
                />
              </div>
            </div>
            
            {!isValid && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Le seuil d'alerte doit être inférieur au seuil critique
                </AlertDescription>
              </Alert>
            )}
          </div>
        );
      })}
    </div>
  );

  const allThresholdsValid = (thresholds: ThresholdConfig): boolean => {
    return Object.keys(thresholds).every(sensor => 
      validateThreshold(sensor as keyof ThresholdConfig, thresholds)
    );
  };

  if (isLoading && !globalThresholds) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="global" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="global">Seuils Globaux</TabsTrigger>
          <TabsTrigger value="motors">Seuils par Moteur</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des Seuils Globaux</CardTitle>
              <CardDescription>
                Ces seuils s'appliquent par défaut à tous les moteurs qui n'ont pas de configuration spécifique.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ThresholdInputs 
                thresholds={globalThresholds}
                onUpdate={updateGlobalThreshold}
                prefix="global-"
              />
              
              <div className="flex items-center space-x-4 pt-4 border-t">
                <Button 
                  onClick={saveGlobalThresholds}
                  disabled={isSaving || !allThresholdsValid(globalThresholds) || !hasChanges}
                  className="flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={resetToDefault}
                  disabled={isSaving || !hasChanges}
                  className="flex items-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Réinitialiser</span>
                </Button>
                
                {hasChanges && (
                  <Badge variant="secondary">Modifications non sauvegardées</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="motors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sélection du Moteur</CardTitle>
              <CardDescription>
                Choisissez un moteur pour configurer ses seuils spécifiques.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {motors.map((motor) => (
                  <div
                    key={motor.id}
                    onClick={() => loadMotorThresholds(motor)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedMotor?.id === motor.id ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <h3 className="font-semibold">{motor.name}</h3>
                    <p className="text-sm text-muted-foreground">{motor.location}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <Badge variant="outline">{motor.status}</Badge>
                      <Badge variant={motor.overallSeverity === 'critical' ? 'destructive' : 'secondary'}>
                        {motor.overallSeverity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedMotor && motorThresholds && (
            <Card>
              <CardHeader>
                <CardTitle>Seuils pour {selectedMotor.name}</CardTitle>
                <CardDescription>
                  Configuration spécifique pour ce moteur. Ces valeurs remplacent les seuils globaux.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ThresholdInputs 
                  thresholds={motorThresholds}
                  onUpdate={updateMotorThreshold}
                  prefix={`motor-${selectedMotor.id}-`}
                />
                
                <div className="flex items-center space-x-4 pt-4 border-t">
                  <Button 
                    onClick={saveMotorThresholds}
                    disabled={isSaving || !allThresholdsValid(motorThresholds)}
                    className="flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSaving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => setMotorThresholds(globalThresholds)}
                    disabled={isSaving}
                    className="flex items-center space-x-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Utiliser les seuils globaux</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Panneau d'aide */}
      <Card>
        <CardHeader>
          <CardTitle>Guide des Seuils</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium mb-2">Température</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Unité: °Celsius</li>
                <li>• Plage normale: 20-35°C</li>
                <li>• Alerte: 35-40°C</li>
                <li>• Critique: &gt;40°C</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Vibration</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Unité: g (accélération)</li>
                <li>• Plage normale: 0.1-1.0g</li>
                <li>• Alerte: 1.0-1.5g</li>
                <li>• Critique: &gt;1.5g</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Son</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Unité: Amplitude relative</li>
                <li>• Plage normale: 0.1-0.7</li>
                <li>• Alerte: 0.7-1.0</li>
                <li>• Critique: &gt;1.0</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThresholdSettings;