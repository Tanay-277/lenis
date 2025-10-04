import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import ChatInterface from "./components/ChatInterface.tsx";
import CaseAnalysis from "./components/CaseAnalysis.tsx";
import ThemeToggle from "./components/ThemeToggle.tsx";
import { useTheme } from "./providers/ThemeProvider.tsx";
import { MessageSquare, Scale } from "lucide-react";

function App() {
	const [activeTab, setActiveTab] = useState<"chat" | "analysis">("chat");

	useTheme();

	return (
		<div className="min-h-screen bg-background">
			{/* Top Navigation */}
			<nav className="border-b border-border bg-card/30 backdrop-blur-xl sticky top-0 z-50">
				<div className="max-w-7xl mx-auto px-6 py-4">
					<div className="flex items-center justify-between">
						{/* Logo & Tabs */}
						<div className="flex items-center gap-8">
							<motion.div
								className="flex items-center gap-3"
								whileHover={{ scale: 1.02 }}
							>
								<div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
									<Scale className="w-5 h-5 text-white" />
								</div>
								<span className="text-xl font-semibold font-pop" >ठप्पा</span>
							</motion.div>

							{/* Tabs */}
							<div className="flex gap-1 bg-muted/50 rounded-lg p-1">
								<motion.button
									onClick={() => setActiveTab("chat")}
									className={`relative px-6 py-2 rounded-md text-sm font-medium transition-colors ${
										activeTab === "chat"
											? "text-foreground"
											: "text-muted-foreground hover:text-foreground"
									}`}
									whileTap={{ scale: 0.98 }}
								>
									{activeTab === "chat" && (
										<motion.div
											layoutId="activeTab"
											className="absolute inset-0 bg-background rounded-md shadow-sm"
											transition={{
												type: "spring",
												bounce: 0.2,
												duration: 0.6,
											}}
										/>
									)}
									<span className="relative flex items-center gap-2">
										<MessageSquare className="w-4 h-4" />
										Chat
									</span>
								</motion.button>

								<motion.button
									onClick={() => setActiveTab("analysis")}
									className={`relative px-6 py-2 rounded-md text-sm font-medium transition-colors ${
										activeTab === "analysis"
											? "text-foreground"
											: "text-muted-foreground hover:text-foreground"
									}`}
									whileTap={{ scale: 0.98 }}
								>
									{activeTab === "analysis" && (
										<motion.div
											layoutId="activeTab"
											className="absolute inset-0 bg-background rounded-md shadow-sm"
											transition={{
												type: "spring",
												bounce: 0.2,
												duration: 0.6,
											}}
										/>
									)}
									<span className="relative flex items-center gap-2">
										<Scale className="w-4 h-4" />
										Analysis
									</span>
								</motion.button>
							</div>
						</div>

						{/* Theme Toggle */}
						<ThemeToggle />
					</div>
				</div>
			</nav>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto p-6">
				<AnimatePresence mode="wait">
					<motion.div
						key={activeTab}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.2 }}
					>
						{activeTab === "chat" ? <ChatInterface /> : <CaseAnalysis />}
					</motion.div>
				</AnimatePresence>
			</main>
		</div>
	);
}

export default App;
