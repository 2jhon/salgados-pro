import React, { useRef, useState, useEffect, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollContainerProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
}

export const ScrollContainer = ({ 
  children, 
  className = "", 
  containerClassName = "",
  style
}: ScrollContainerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    let rafId: number;

    const handleScroll = () => {
      if (typeof window === 'undefined') return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (el) {
          const { scrollLeft, scrollWidth, clientWidth } = el;
          setShowLeft(scrollLeft > 20); // 20px threshold
          setShowRight(scrollLeft < scrollWidth - clientWidth - 20);
        }
      });
    };

    if (el) {
      handleScroll();
      el.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll);
      
      // Observer for content changes (only direct children to avoid excessive firing)
      const observer = new MutationObserver(handleScroll);
      observer.observe(el, { childList: true });

      return () => {
        el.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
        observer.disconnect();
        cancelAnimationFrame(rafId);
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
        className={`transform-gpu no-scrollbar ${className}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', ...style }}
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
