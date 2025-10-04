import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../providers/ThemeProvider";
import { Button } from "./ui/button";
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
					<Button
						variant="outline"
						size="icon"
						className="rounded-full h-9 w-9 border-border/60 bg-background/95 backdrop-blur-sm shadow-sm hover:bg-accent hover:text-accent-foreground transition-all"
						onClick={() => toggleTheme()}
						aria-label={
							isDark ? "Switch to light theme" : "Switch to dark theme"
						}
					>
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={isDark ? "dark" : "light"}
								initial={{ y: -20, opacity: 0 }}
								animate={{ y: 0, opacity: 1 }}
								exit={{ y: 20, opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="h-full w-full flex items-center justify-center"
							>
								{isDark ? (
									<FiMoon className="h-4 w-4 text-secondary-400" />
								) : (
									<FiSun className="h-4 w-4 text-amber-500" />
								)}
							</motion.div>
						</AnimatePresence>
					</Button>
				</TooltipTrigger>
				<TooltipContent sideOffset={5}>
					<span>{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
