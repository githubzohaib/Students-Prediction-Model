// src/pages/Error500.tsx
import { buttonVariants } from "@/components/ui/button";
import { NavLink } from "react-router-dom";
import { RefreshCw, Home } from "lucide-react";
import { useState, useEffect } from "react";

export default function Error500() {
  const [quote, setQuote] = useState("");
  const [author, setAuthor] = useState("");
  
  const bookQuotes = [
    { quote: "So many books, so little time.", author: "Frank Zappa" },
    { quote: "A room without books is like a body without a soul.", author: "Cicero" },
    { quote: "Books are a uniquely portable magic.", author: "Stephen King" },
    { quote: "The library is inhabited by spirits that come out of the pages at night.", author: "Isabel Allende" },
    { quote: "That's the thing about books. They let you travel without moving your feet.", author: "Jhumpa Lahiri" },
    { quote: "I have always imagined that Paradise will be a kind of library.", author: "Jorge Luis Borges" }
  ];
  
  useEffect(() => {
    const randomQuote = bookQuotes[Math.floor(Math.random() * bookQuotes.length)];
    setQuote(randomQuote.quote);
    setAuthor(randomQuote.author);
  }, []);
  
  return (
    <div className="bg-background text-foreground flex-grow flex items-center justify-center px-4">
      <div className="max-w-lg py-12 px-6 md:px-12 rounded-lg border border-muted shadow-lg">
        <div className="space-y-6 text-center">
          {/* Animated book stack */}
          <div className="flex justify-center mb-2">
            <div className="relative h-24 w-32">
              <div className="absolute bottom-0 left-0 w-20 h-12 bg-indigo-600 rounded-sm animate-bounce delay-100" style={{ animationDuration: '2.5s' }}></div>
              <div className="absolute bottom-2 left-3 w-20 h-12 bg-cyan-500 rounded-sm animate-bounce delay-300" style={{ animationDuration: '2.3s' }}></div>
              <div className="absolute bottom-4 left-6 w-20 h-12 bg-amber-500 rounded-sm animate-bounce delay-500" style={{ animationDuration: '2.7s' }}></div>
            </div>
          </div>
        
          <h1 className="text-3xl font-bold tracking-tight">Oops! The page is bookmarked for repair</h1>
          
          <div className="py-4 px-6 bg-muted/50 rounded-lg italic">
            <p className="text-lg">"{quote}"</p>
            <p className="text-sm text-muted-foreground mt-2">— {author}</p>
          </div>
          
          <p className="text-muted-foreground">
            We're having trouble retrieving your book recommendations right now. 
            Like a misplaced bookmark, this is just a temporary setback on our journey together.
          </p>
          
          <div className="flex justify-center gap-4 pt-2">
            <NavLink to="/" className={buttonVariants({ variant: "default" })}>
              <Home className="mr-2 h-4 w-4" />
              Return Home
            </NavLink>
            <button onClick={() => window.location.reload()} className={buttonVariants({ variant: "outline" })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}