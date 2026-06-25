import { CalendarClock, BadgeCheck, UserRound } from "lucide-react";

const Services = () => {
  const services = [
    {
      icon: CalendarClock,
      description:
        "Explore our online databases, e-journals, and digital archives accessible to all NED University students and faculty.",
    },
    {
      icon: BadgeCheck,
      description:
        "Get assistance with your research projects, including guidance on literature reviews and citation management at NED University.",
    },
    {
      icon: UserRound,
      description:
        "Our knowledgeable staff is here to help you find the information you need and utilize library resources effectively at NED University.",
    },
  ];

  return (
    <section className="w-full px-4 md:px-8 py-10 md:mt-20" id="services">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-bold text-3xl md:text-4xl lg:text-[36px] mb-8 md:mb-12 text-redcustom">
          Services
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {services.map((service, idx) => (
            <div
              key={idx}
              className={`flex-1 px-4 md:px-6 py-8 md:py-10 flex flex-col items-center text-center relative
                ${idx !== services.length - 1 
                  ? 'md:border-r-2 border-b-2 md:border-b-0 border-gray-300 pb-8 md:pb-0' 
                  : ''}
                ${idx < services.length - 1 ? 'mb-4 md:mb-0' : ''}`}
            >
              <service.icon className="h-16 w-16 md:h-20 md:w-20 mb-4 md:mb-6" />
              <p className="text-sm md:text-base lg:text-lg leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;