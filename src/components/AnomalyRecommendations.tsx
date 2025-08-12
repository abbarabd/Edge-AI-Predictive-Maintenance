import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Lightbulb, 
  Wrench, 
  Zap, 
  Fan, 
  Settings,
  CheckCircle 
} from 'lucide-react';

interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  icon: JSX.Element;
}

interface AnomalyRecommendationsProps {
  anomalyType: string;
  severity: string;
}

export const AnomalyRecommendations = ({ anomalyType }: AnomalyRecommendationsProps) => {
  const getRecommendations = (type: string): Recommendation[] => {
    switch (type) {
      case 'temperature':
        return [
          {
            title: "Vérifier le système de refroidissement",
            description: "Contrôler l'état des ventilateurs et la circulation d'air autour du moteur",
            priority: 'high',
            action: "Inspection immédiate du refroidissement",
            icon: <Fan className="h-4 w-4" />
          },
          {
            title: "Examiner la source d'alimentation",
            description: "Une surtension peut causer une surchauffe excessive du moteur",
            priority: 'high',
            action: "Mesurer les tensions d'alimentation",
            icon: <Zap className="h-4 w-4" />
          },
          {
            title: "Vérifier la charge du moteur",
            description: "Une surcharge peut provoquer un échauffement anormal",
            priority: 'medium',
            action: "Analyser la charge appliquée",
            icon: <Settings className="h-4 w-4" />
          }
        ];
      
      case 'vibration':
      case 'imbalance':
        return [
          {
            title: "Inspecter le rotor",
            description: "Vérifier l'équilibrage et l'état du rotor pour détecter d'éventuels défauts",
            priority: 'high',
            action: "Contrôle de l'équilibrage du rotor",
            icon: <Settings className="h-4 w-4" />
          },
          {
            title: "Examiner le stator",
            description: "Contrôler l'état des bobinages et la fixation du stator",
            priority: 'high',
            action: "Inspection des bobinages stator",
            icon: <Wrench className="h-4 w-4" />
          },
          {
            title: "Vérifier les roulements",
            description: "L'usure des roulements est une cause fréquente de vibrations",
            priority: 'medium',
            action: "Contrôle de l'état des roulements",
            icon: <Settings className="h-4 w-4" />
          }
        ];
      
      case 'sound':
        return [
          {
            title: "Analyser les roulements",
            description: "Un bruit anormal peut indiquer une usure prématurée des roulements",
            priority: 'high',
            action: "Inspection acoustique des roulements",
            icon: <Settings className="h-4 w-4" />
          },
          {
            title: "Vérifier l'alignement",
            description: "Un mauvais alignement peut provoquer des bruits parasites",
            priority: 'medium',
            action: "Contrôle de l'alignement mécanique",
            icon: <Wrench className="h-4 w-4" />
          },
          {
            title: "Examiner la lubrification",
            description: "Une lubrification inadéquate peut causer des bruits anormaux",
            priority: 'medium',
            action: "Vérification du système de lubrification",
            icon: <Settings className="h-4 w-4" />
          }
        ];
      
      default:
        return [
          {
            title: "Inspection générale",
            description: "Effectuer un contrôle visuel complet du moteur",
            priority: 'medium',
            action: "Inspection visuelle et auditive",
            icon: <CheckCircle className="h-4 w-4" />
          }
        ];
    }
  };

  const recommendations = getRecommendations(anomalyType);
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-severity-critical';
      case 'medium': return 'text-severity-warning';
      case 'low': return 'text-severity-normal';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-severity-critical/10 border-severity-critical/20';
      case 'medium': return 'bg-severity-warning/10 border-severity-warning/20';
      case 'low': return 'bg-severity-normal/10 border-severity-normal/20';
      default: return 'bg-muted/10 border-muted/20';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <span>Recommandations d'Intervention</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <Alert key={index} className={`border ${getPriorityBg(rec.priority)}`}>
              <div className="flex items-start space-x-3">
                <div className={`mt-0.5 ${getPriorityColor(rec.priority)}`}>
                  {rec.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-sm">{rec.title}</h4>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      rec.priority === 'high' ? 'bg-severity-critical/20 text-severity-critical' :
                      rec.priority === 'medium' ? 'bg-severity-warning/20 text-severity-warning' :
                      'bg-severity-normal/20 text-severity-normal'
                    }`}>
                      {rec.priority === 'high' ? 'Priorité élevée' :
                       rec.priority === 'medium' ? 'Priorité moyenne' :
                       'Priorité faible'}
                    </span>
                  </div>
                  <AlertDescription>
                    <p className="text-sm mb-2">{rec.description}</p>
                    <p className="text-xs font-medium text-primary">
                      Action recommandée: {rec.action}
                    </p>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};