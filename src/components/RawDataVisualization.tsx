import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  LineChart, 
  Activity,
  Thermometer,
  Volume2,
  Download,
  Zap
} from 'lucide-react';

interface RawSensorData {
  _id: string;
  machineId: string;
  timestamp_rpi: string;
  temperature_c: number;
  accel_x_g: number;
  accel_y_g: number;
  accel_z_g: number;
  raw_sound_analog: number;
  fault_type: string;
  __v: number;
}

interface RawDataVisualizationProps {
  data: RawSensorData[];
  machineId: string;
}

export const RawDataVisualization = ({ data, machineId }: RawDataVisualizationProps) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h'>('1h');
  const [viewType, setViewType] = useState<'timeseries' | 'spectral' | 'correlation'>('timeseries');

  // Filtrer les données selon la plage temporelle
  const getFilteredData = () => {
    const now = new Date();
    const hoursBack = selectedTimeRange === '1h' ? 1 : selectedTimeRange === '6h' ? 6 : 24;
    const cutoffTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    return data.filter(d => new Date(d.timestamp_rpi) >= cutoffTime);
  };

  const filteredData = getFilteredData();

  // Calculer les statistiques
  const stats = {
    total_points: filteredData.length,
    faults_detected: filteredData.filter(d => d.fault_type !== 'Normal').length,
    avg_temperature: filteredData.reduce((sum, d) => sum + d.temperature_c, 0) / filteredData.length,
    max_acceleration: Math.max(...filteredData.map(d => Math.sqrt(d.accel_x_g ** 2 + d.accel_y_g ** 2 + d.accel_z_g ** 2))),
    avg_sound: filteredData.reduce((sum, d) => sum + d.raw_sound_analog, 0) / filteredData.length
  };

  // Graphique série temporelle SVG
  const renderTimeSeriesChart = (dataKey: keyof RawSensorData, title: string, color: string, unit: string) => {
    if (filteredData.length === 0) return null;

    const chartWidth = 800;
    const chartHeight = 300;
    const padding = 50;

    const values = filteredData.map(d => typeof d[dataKey] === 'number' ? d[dataKey] as number : 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    const xScale = (index: number) => 
      padding + (index / (filteredData.length - 1)) * (chartWidth - 2 * padding);
      
    const yScale = (value: number) => 
      chartHeight - padding - ((value - minValue) / range) * (chartHeight - 2 * padding);

    const pathData = values.map((value, index) => {
      const x = xScale(index);
      const y = yScale(value);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
      <div className="w-full bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center space-x-2">
            <span>{title}</span>
            <Badge variant="outline">{filteredData.length} points</Badge>
          </h4>
          <div className="text-sm text-muted-foreground">
            Plage: {minValue.toFixed(2)} - {maxValue.toFixed(2)} {unit}
          </div>
        </div>
        
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {/* Grille */}
          <defs>
            <pattern id={`grid-${dataKey}`} width="40" height="30" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 30" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${dataKey})`} />
          
          {/* Courbe principale */}
          <path
            d={pathData}
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Points de données avec code couleur selon fault_type */}
          {filteredData.map((point, index) => (
            <circle
              key={point._id}
              cx={xScale(index)}
              cy={yScale(typeof point[dataKey] === 'number' ? point[dataKey] as number : 0)}
              r="2"
              fill={point.fault_type === 'Normal' ? color : 'hsl(var(--destructive))'}
              stroke="white"
              strokeWidth="1"
            >
              <title>
                {`${new Date(point.timestamp_rpi).toLocaleTimeString()}: ${
                  typeof point[dataKey] === 'number' ? (point[dataKey] as number).toFixed(3) : 'N/A'
                }${unit} - ${point.fault_type}`}
              </title>
            </circle>
          ))}
          
          {/* Axes */}
          <text x={padding} y={chartHeight - 10} fontSize="12" fill="hsl(var(--muted-foreground))">
            {new Date(filteredData[0]?.timestamp_rpi).toLocaleTimeString()}
          </text>
          <text x={chartWidth - padding - 50} y={chartHeight - 10} fontSize="12" fill="hsl(var(--muted-foreground))">
            {new Date(filteredData[filteredData.length - 1]?.timestamp_rpi).toLocaleTimeString()}
          </text>
          
          <text x={padding - 5} y={yScale(maxValue) + 5} fontSize="12" fill="hsl(var(--muted-foreground))" textAnchor="end">
            {maxValue.toFixed(2)}
          </text>
          <text x={padding - 5} y={yScale(minValue) + 5} fontSize="12" fill="hsl(var(--muted-foreground))" textAnchor="end">
            {minValue.toFixed(2)}
          </text>
        </svg>
      </div>
    );
  };

  // Analyse spectrale simulée (FFT-like visualization)
  const renderSpectralAnalysis = () => {
    const frequencies = Array.from({ length: 50 }, (_, i) => i * 10); // 0-500 Hz
    const amplitudes = frequencies.map(f => 
      Math.exp(-f / 200) * (1 + 0.5 * Math.sin(f / 50)) * Math.random()
    );

    const chartWidth = 800;
    const chartHeight = 300;
    const padding = 50;
    const barWidth = (chartWidth - 2 * padding) / frequencies.length;

    const maxAmplitude = Math.max(...amplitudes);

    return (
      <div className="w-full bg-card border rounded-lg p-4">
        <h4 className="font-semibold mb-4 flex items-center space-x-2">
          <BarChart3 className="h-4 w-4" />
          <span>Analyse Spectrale (Simulation FFT)</span>
        </h4>
        
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {/* Barres de fréquence */}
          {frequencies.map((freq, index) => {
            const barHeight = (amplitudes[index] / maxAmplitude) * (chartHeight - 2 * padding);
            const x = padding + index * barWidth;
            const y = chartHeight - padding - barHeight;
            
            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={barWidth - 1}
                height={barHeight}
                fill="hsl(217 91% 60%)"
                opacity={0.8}
              >
                <title>{`${freq} Hz: ${amplitudes[index].toFixed(3)}`}</title>
              </rect>
            );
          })}
          
          {/* Axes */}
          <text x={padding} y={chartHeight - 10} fontSize="12" fill="hsl(var(--muted-foreground))">
            0 Hz
          </text>
          <text x={chartWidth - padding - 30} y={chartHeight - 10} fontSize="12" fill="hsl(var(--muted-foreground))">
            500 Hz
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Contrôles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Données Brutes de Capteurs - {machineId}</span>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Sélection plage temporelle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Plage temporelle</label>
              <div className="flex gap-2">
                {(['1h', '6h', '24h'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={selectedTimeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>

            {/* Type de visualisation */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type d'analyse</label>
              <div className="flex gap-2">
                <Button
                  variant={viewType === 'timeseries' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewType('timeseries')}
                >
                  <LineChart className="h-4 w-4 mr-1" />
                  Temporelle
                </Button>
                <Button
                  variant={viewType === 'spectral' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewType('spectral')}
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Spectrale
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total_points}</div>
            <p className="text-sm text-muted-foreground">Points de données</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-severity-critical">{stats.faults_detected}</div>
            <p className="text-sm text-muted-foreground">Anomalies détectées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avg_temperature.toFixed(1)}°C</div>
            <p className="text-sm text-muted-foreground">Temp. moyenne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.max_acceleration.toFixed(3)}g</div>
            <p className="text-sm text-muted-foreground">Accél. max</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.avg_sound.toFixed(0)}</div>
            <p className="text-sm text-muted-foreground">Son moyen</p>
          </CardContent>
        </Card>
      </div>

      {/* Visualisations */}
      {viewType === 'timeseries' && (
        <Tabs defaultValue="acceleration" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="acceleration">
              <Zap className="h-4 w-4 mr-1" />
              Accélération
            </TabsTrigger>
            <TabsTrigger value="temperature">
              <Thermometer className="h-4 w-4 mr-1" />
              Température
            </TabsTrigger>
            <TabsTrigger value="sound">
              <Volume2 className="h-4 w-4 mr-1" />
              Son
            </TabsTrigger>
            <TabsTrigger value="combined">
              <Activity className="h-4 w-4 mr-1" />
              Vue globale
            </TabsTrigger>
          </TabsList>

          <TabsContent value="acceleration" className="space-y-4">
            {renderTimeSeriesChart('accel_x_g', 'Accélération X', 'hsl(0 84% 60%)', 'g')}
            {renderTimeSeriesChart('accel_y_g', 'Accélération Y', 'hsl(142 76% 36%)', 'g')}
            {renderTimeSeriesChart('accel_z_g', 'Accélération Z', 'hsl(217 91% 60%)', 'g')}
          </TabsContent>

          <TabsContent value="temperature">
            {renderTimeSeriesChart('temperature_c', 'Température', 'hsl(25 95% 53%)', '°C')}
          </TabsContent>

          <TabsContent value="sound">
            {renderTimeSeriesChart('raw_sound_analog', 'Signal Sonore Brut', 'hsl(262 83% 58%)', '')}
          </TabsContent>

          <TabsContent value="combined">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {renderTimeSeriesChart('temperature_c', 'Température', 'hsl(25 95% 53%)', '°C')}
              {renderTimeSeriesChart('raw_sound_analog', 'Signal Sonore', 'hsl(262 83% 58%)', '')}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {viewType === 'spectral' && (
        <Card>
          <CardContent className="pt-6">
            {renderSpectralAnalysis()}
            <div className="mt-4 p-4 bg-muted/20 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> L'analyse spectrale permet d'identifier les fréquences caractéristiques 
                des défauts mécaniques. Les pics à certaines fréquences peuvent indiquer des problèmes spécifiques 
                (déséquilibre, défauts de roulements, etc.).
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};