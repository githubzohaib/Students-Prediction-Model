import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="w-full px-4 md:px-8 py-10">
      <div className="flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl md:text-4xl font-semibold">
          
          <span className="text-4xl md:text-5xl font-bold">
          NextBook
          </span>
          <br />
          <span className="text-3xl md:text-3xl font-bold">
            BY EAKL
          </span>
        </h1>

        <p className="mt-6 max-w-2xl mx-auto">
        Your gateway to knowledge and resources at NED University. Explore our extensive collection and services to support your academic journey.
        </p>

        <Button className="mt-8 px-6 py-3 rounded-lg flex items-center gap-2" onClick={()=>{navigate("/sign-in")}}>
          Get Started
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </section>
  );
};

export default Hero;
