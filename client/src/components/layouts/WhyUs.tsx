import React from 'react';

const WhyUsSection = () => {
  const data = [
    {
      title: "5+",
      value: "Sources Used In the LLM"
    },
    {
      title: "10x",
      value: "Faster Book Discovery"
    },    
    {
      title: "16k+",
      value: "Books And Resources"
    }
  ];

  return (
    <section className="px-4 md:px-8 py-10 bg-redbgcustom border-t-2 border-b-2 border-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-center font-bold text-3xl md:text-4xl lg:text-[36px] mb-5">
            Why Us ?
          </h2>
          <p className="text-base md:text-lg">
            Discover the advantages of using the Engr. Abul Kalam Library at NED University.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 md:gap-y-0 mt-10">
          {data.map((item, index) => (
            <div 
              key={index} 
              className={`flex flex-col items-center px-4 
                ${index !== data.length - 1 
                  ? 'border-b md:border-b-0 md:border-r border-gray-500 pb-8 md:pb-0' 
                  : ''}
                ${index === 0 ? 'md:border-r' : ''}
                ${index === 1 ? 'md:border-r' : ''}
              `}
            >
              <div className="text-4xl md:text-5xl lg:text-[60px] font-bold mb-2">
                {item.title}
              </div>
              <p className="text-base md:text-lg lg:text-[18px] text-center">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyUsSection;