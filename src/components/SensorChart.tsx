import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SensorData } from '@/data/mockData';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface SensorChartProps {
  data: SensorData[];
  title: string;
  color: string;
  unit: string;
  threshold: number;
}

export const SensorChart = ({ data, title, color, unit, threshold }: SensorChartProps) => {
  // Calculer les statistiques
  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const previousValue = data.length > 1 ? data[data.length - 2].value : latestValue;
  const change = latestValue - previousValue;
  const changePercent = previousValue !== 0 ? ((change / previousValue) * 100) : 0;
  
  const maxValue = Math.max(...data.map(d => d.value), threshold);
  const minValue = Math.min(...data.map(d => d.value));
  const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;

  // Prendre seulement les dernières 24 heures de données (une valeur toutes les 5 min = 288 points)
  const recentData = data.slice(-48); // Dernières 4 heures pour une visualisation plus claire

  // Créer les points du graphique SVG
  const chartWidth = 600;
  const chartHeight = 200;
  const padding = 40;

  const xScale = (index: number) => 
    padding + (index / (recentData.length - 1)) * (chartWidth - 2 * padding);
    
  const yScale = (value: number) => 
    chartHeight - padding - ((value - minValue) / (maxValue - minValue)) * (chartHeight - 2 * padding);

  const pathData = recentData.map((point, index) => {
    const x = xScale(index);
    const y = yScale(point.value);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Ligne de seuil
  const thresholdY = yScale(threshold);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isAboveThreshold = latestValue > threshold;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center space-x-2">
            {change !== 0 && (
              <div className={`flex items-center text-sm ${
                change > 0 ? 'text-severity-warning' : 'text-accent'
              }`}>
                <TrendingUp className={`h-4 w-4 mr-1 ${change < 0 ? 'rotate-180' : ''}`} />
                <span>{change > 0 ? '+' : ''}{changePercent.toFixed(1)}%</span>
              </div>
            )}
            {isAboveThreshold && (
              <AlertTriangle className="h-4 w-4 text-severity-critical" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Valeurs principales */}
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold" style={{ color }}>
                {latestValue.toFixed(1)}{unit}
              </div>
              <div className="text-xs text-muted-foreground">Actuelle</div>
            </div>
            <div>
              <div className="text-lg font-semibold">
                {avgValue.toFixed(1)}{unit}
              </div>
              <div className="text-xs text-muted-foreground">Moyenne</div>
            </div>
            <div>
              <div className="text-lg font-semibold">
                {maxValue.toFixed(1)}{unit}
              </div>
              <div className="text-xs text-muted-foreground">Maximum</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-severity-warning">
                {threshold}{unit}
              </div>
              <div className="text-xs text-muted-foreground">Seuil</div>
            </div>
          </div>

          {/* Graphique SVG simplifié */}
          <div className="w-full bg-card border rounded-lg p-4">
            <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              {/* Grille de fond */}
              <defs>
                <pattern id="grid" width="50" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Zone de seuil */}
              <rect 
                x={padding} 
                y={thresholdY} 
                width={chartWidth - 2 * padding} 
                height={chartHeight - padding - thresholdY}
                fill="hsl(var(--destructive))"
                fillOpacity="0.1"
              />
              
              {/* Ligne de seuil */}
              <line 
                x1={padding} 
                y1={thresholdY} 
                x2={chartWidth - padding} 
                y2={thresholdY}
                stroke="hsl(var(--destructive))"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
              
              {/* Courbe des données */}
              <path
                d={pathData}
                stroke={color}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Points de données */}
              {recentData.map((point, index) => (
                <circle
                  key={index}
                  cx={xScale(index)}
                  cy={yScale(point.value)}
                  r="3"
                  fill={point.value > threshold ? "hsl(var(--destructive))" : color}
                  stroke="white"
                  strokeWidth="2"
                >
                  <title>{`${formatTime(point.timestamp)}: ${point.value.toFixed(2)}${unit}`}</title>
                </circle>
              ))}
              
              {/* Étiquettes des axes */}
              <text x={padding} y={chartHeight - 10} fontSize="12" fill="hsl(var(--muted-foreground))">
                {formatTime(recentData[0]?.timestamp || '')}
              </text>
              <text x={chartWidth - padding - 30} y={chartHeight - 10} fontSize="12" fill="hsl(var(--muted-foreground))">
                {formatTime(recentData[recentData.length - 1]?.timestamp || '')}
              </text>
              
              {/* Étiquettes Y */}
              <text x={padding - 5} y={yScale(maxValue) + 5} fontSize="12" fill="hsl(var(--muted-foreground))" textAnchor="end">
                {maxValue.toFixed(0)}
              </text>
              <text x={padding - 5} y={yScale(minValue) + 5} fontSize="12" fill="hsl(var(--muted-foreground))" textAnchor="end">
                {minValue.toFixed(0)}
              </text>
            </svg>
          </div>

          {/* Indicateurs de tendance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex justify-between">
              <span>Tendance:</span>
              <span className={`font-medium ${
                change > 0 ? 'text-severity-warning' : 
                change < 0 ? 'text-accent' : 'text-muted-foreground'
              }`}>
                {change > 0 ? 'Hausse' : change < 0 ? 'Baisse' : 'Stable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>État:</span>
              <span className={`font-medium ${
                isAboveThreshold ? 'text-severity-critical' : 'text-accent'
              }`}>
                {isAboveThreshold ? 'Au-dessus du seuil' : 'Normal'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dernière mesure:</span>
              <span className="font-medium text-muted-foreground">
                {formatTime(recentData[recentData.length - 1]?.timestamp || '')}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};