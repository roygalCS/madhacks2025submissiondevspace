import { CheckCircle2 } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Create a task or join a call",
    description: "Describe what you need built or start a video session. DevSpace understands natural language and technical requirements.",
  },
  {
    number: "02",
    title: "Agents spin up & start working",
    description: "AI engineers are assigned based on your task. They collaborate in parallel, writing code and solving problems autonomously.",
  },
  {
    number: "03",
    title: "Review, merge, and ship code changes",
    description: "Check pull requests in Cursor or Replit. Agents explain their work, respond to feedback, and iterate until it's perfect.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 px-6 bg-secondary/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-gradient">
            How It Works
          </h2>
          <p className="text-xl text-muted-foreground">
            From idea to deployment in three simple steps
          </p>
        </div>

        <div className="space-y-12">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex gap-8 items-start animate-slide-in-up"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary">
                  <span className="text-2xl font-bold text-primary">{step.number}</span>
                </div>
              </div>
              <div className="flex-grow pt-2">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-1" />
                  <h3 className="text-2xl md:text-3xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed ml-9">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
