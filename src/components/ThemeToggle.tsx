import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../providers/ThemeProvider";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

export default function ThemeToggle() {
	const { theme, toggleTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Avoid hydration mismatch by only rendering after component mounts
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;

	const isDark = theme === "dark";

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<motion.button
						className="relative rounded-full h-10 w-10 border border-border/50 bg-card/60 backdrop-blur-sm shadow-premium hover:shadow-glow transition-all flex items-center justify-center"
						onClick={() => toggleTheme()}
						aria-label={
							isDark ? "Switch to light theme" : "Switch to dark theme"
						}
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
					>
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={isDark ? "dark" : "light"}
								initial={{ y: -20, opacity: 0, rotate: -90 }}
								animate={{ y: 0, opacity: 1, rotate: 0 }}
								exit={{ y: 20, opacity: 0, rotate: 90 }}
								transition={{ duration: 0.3 }}
								className="h-full w-full flex items-center justify-center"
							>
								{isDark ? (
									<FiMoon className="h-5 w-5 text-secondary" />
								) : (
									<FiSun className="h-5 w-5 text-amber-500" />
								)}
							</motion.div>
						</AnimatePresence>
					</motion.button>
				</TooltipTrigger>
				<TooltipContent sideOffset={5}>
					<span>{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
