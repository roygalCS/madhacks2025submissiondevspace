import { Code2, Video, Zap, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: Code2,
    title: "AI Coworkers",
    description: "Generate backend, frontend, tests, and migrations. Your agents write production-ready code while you focus on strategy.",
  },
  {
    icon: Video,
    title: "Calls & Collaboration",
    description: "Real-time video calls with Ready Player Me 3D avatars and Fish Audio voices. Agents join meetings, discuss architecture, and present solutions with realistic lip sync.",
  },
  {
    icon: Zap,
    title: "Parallel Execution",
    description: "Tasks run simultaneously across multiple agents. What takes days alone happens in hours with your AI team.",
  },
  {
    icon: Brain,
    title: "Memory & Context",
    description: "Agents remember your codebase, goals, and past decisions. They learn your patterns and improve over time.",
  },
];

const Features = () => {
  return (
    <section className="py-24 px-6 relative">
      <div className="container mx-auto">
        <div className="text-center mb-16 animate-slide-in-up">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-gradient">
            Built for Solo Founders
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to scale development without hiring a team
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-8 bg-card border-border hover:border-primary/50 transition-all duration-300 hover:card-glow animate-slide-in-up group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mb-6 p-4 bg-primary/10 rounded-xl w-fit group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
