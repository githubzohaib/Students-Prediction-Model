import { Card, CardContent } from "@/components/ui/card";
import {
  BrainCircuit,
  GraduationCap,
  Hourglass,
  Globe,
} from "lucide-react";
const AboutUs = () => {
  const features = [
    {
      icon: BrainCircuit,
      description:
        "Nextbook LLM uses advanced AI to personalize book recommendations for students and facutlty, making learning more efficient and engaging.",
    },
    {
      icon: GraduationCap,
      description:
        "Our LLM adapts to individual students and facutlty needs, considering their academic level, interests, and learning style to suggest the most relevant titles.",
    },
    {
      icon: Hourglass,
      description:
        "By filtering out irrelevant information, Nextbook LLM saves students and facutlty valuable time.",
    },
    {
      icon: Globe,
      description:
        "Nextbook helps students and facutlty discover hidden gems and essential resources they might otherwise miss, broadening their knowledge and academic horizons",
    },
  ];
  return (
    <section className={`w-full px-4 md:px-8 py-10`} id="about-us">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2
          className={`text-center font-bold text-[24px] leading-[100%] mb-12 text-redcustom`}
        >
          About NextBook
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
          {features.map((feature, idx) => (
            <Card
              key={idx}
              className={`bg-redbgcustom border-[2px] border-black rounded-[8px] text-black`}
            >
              <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center space-y-4 text-center text-black">
                <feature.icon className={`w-[70px] h-[70px]`} size={28} />
                <p className={`text-sm md:text-base`}>{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutUs;

