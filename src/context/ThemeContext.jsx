import { createContext, useContext, useState, useRef, useCallback } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('light');
    const [transitioning, setTransitioning] = useState(false);
    const [circleStyle, setCircleStyle] = useState({});
    const toggleRef = useRef(null);

    const toggleTheme = useCallback((e) => {
        if (transitioning) return;

        // Get the click origin (the toggle button position)
        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // Calculate the max distance to corner to know how big the circle needs to be
        const maxDist = Math.sqrt(
            Math.max(x, window.innerWidth - x) ** 2 +
            Math.max(y, window.innerHeight - y) ** 2
        );

        const newTheme = theme === 'light' ? 'dark' : 'light';

        setCircleStyle({
            left: x,
            top: y,
            maxRadius: maxDist + 50,
            targetTheme: newTheme,
        });
        setTransitioning(true);

        // After the animation completes, switch the theme
        setTimeout(() => {
            setTheme(newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            // Let ring finish, then remove it
            setTimeout(() => {
                setTransitioning(false);
            }, 100);
        }, 600); // Match the CSS animation duration
    }, [theme, transitioning]);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, toggleRef }}>
            {children}
            {/* The expanding circle overlay */}
            {transitioning && (
                <div
                    className="theme-circle-overlay"
                    style={{
                        '--cx': `${circleStyle.left}px`,
                        '--cy': `${circleStyle.top}px`,
                        '--max-r': `${circleStyle.maxRadius}px`,
                    }}
                >
                    <div
                        className={`theme-circle ${circleStyle.targetTheme === 'dark' ? 'to-dark' : 'to-light'}`}
                    />
                </div>
            )}
        </ThemeContext.Provider>
    );
}
