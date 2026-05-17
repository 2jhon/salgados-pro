import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const ScrollContainer: React.FC<ScrollContainerProps> = ({ 
  children, 
  className = "", 
  containerClassName = "" 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 20); // 20px threshold
      setShowRight(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      checkScroll();
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      
      // Observer for content changes
      const observer = new MutationObserver(checkScroll);
      observer.observe(el, { childList: true, subtree: true });

      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
        observer.disconnect();
      };
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const amount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative group/scroll ${containerClassName}`}>
      {/* Left Arrow */}
      <button
        onClick={() => scroll('left')}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 backdrop-blur-sm shadow-xl rounded-full flex items-center justify-center text-slate-600 transition-all duration-300 border border-slate-100 sm:opacity-0 sm:group-hover/scroll:opacity-100 ${showLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="Rolar para esquerda"
      >
        <ChevronLeft size={20} className="mr-0.5" />
      </button>

      {/* Main Container */}
      <div
        ref={scrollRef}
        className={`no-scrollbar ${className}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Right Arrow */}
      <button
        onClick={() => scroll('right')}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/90 backdrop-blur-sm shadow-xl rounded-full flex items-center justify-center text-slate-600 transition-all duration-300 border border-slate-100 sm:opacity-0 sm:group-hover/scroll:opacity-100 ${showRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="Rolar para direita"
      >
        <ChevronRight size={20} className="ml-0.5" />
      </button>

      {/* Gradient Indicators for Mobile (Subtle) */}
      <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/40 to-transparent pointer-events-none transition-opacity duration-300 ${showLeft ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/40 to-transparent pointer-events-none transition-opacity duration-300 ${showRight ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
};
