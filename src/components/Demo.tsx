import { Play } from "lucide-react";
import { Card } from "@/components/ui/card";

const Demo = () => {
  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-gradient">
            See DevSpace in Action
          </h2>
          <p className="text-xl text-muted-foreground">
            Watch AI engineers collaborate and ship features in real-time
          </p>
        </div>

        <Card className="relative overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300 card-glow animate-slide-in-up">
          <div className="aspect-video bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 mx-auto rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary animate-glow-pulse">
                <Play className="h-12 w-12 text-primary fill-primary ml-1" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground mb-2">Demo Video</p>
                <p className="text-muted-foreground">
                  Watch how DevSpace agents build, test, and deploy features
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default Demo;
