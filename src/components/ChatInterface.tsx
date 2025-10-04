import { useState, useRef, useEffect } from "react";
import {
	FiSend,
	FiUser,
	FiCpu,
	FiCopy,
	FiCheck,
	FiLink,
	FiAlertTriangle,
	FiCode,
	FiClock,
} from "react-icons/fi";
import { HiOutlineChatAlt, HiOutlineLightBulb } from "react-icons/hi";
import { motion } from "framer-motion";
import {
	getStructuredChatResponse,
	StructuredChatResponse,
	ChatResponseItem,
	canMakeRequest,
	getTimeUntilNextRequest,
} from "../utils/gemini";

import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface Message {
	type: "user" | "ai" | "error" | "rate_limit";
	content: string;
	timestamp: Date;
	structuredResponse?: StructuredChatResponse;
}



const SYSTEM_INSTRUCTION = `
You are a professional legal advisor assistant focused on Indian legal systems.
Provide accurate, well-structured information about legal matters, rights, procedures, and legal guidance.
Always emphasize that this is general legal information and not a substitute for professional legal counsel.
Structure responses in a way that makes complex legal information easy to understand for users.
Focus on being helpful, accurate, and clear while maintaining professional legal standards.
`;

const ChatInterface = () => {
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
	const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const suggestions = [
		"What are my rights as a tenant in India under the Rent Control Act?",
		"How do I file a consumer complaint under the Consumer Protection Act?",
		"What is the procedure for divorce in India under Hindu Marriage Act?",
		"What legal documents do I need to buy property in India?",
		"How to register an FIR and what are my rights during police investigation?",
	];

	// Check rate limit status periodically
	useEffect(() => {
		const checkRateLimit = () => {
			if (!canMakeRequest()) {
				const timeUntilNext = getTimeUntilNextRequest();
				setRateLimitCountdown(Math.ceil(timeUntilNext / 1000));
			} else {
				setRateLimitCountdown(0);
			}
		};

		checkRateLimit();
		const interval = setInterval(checkRateLimit, 1000);

		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!input.trim()) return;

		// Check rate limit before submitting
		if (!canMakeRequest()) {
			const timeUntilNext = getTimeUntilNextRequest();
			const rateLimitMessage: Message = {
				type: "rate_limit",
				content: `Please wait ${Math.ceil(
					timeUntilNext / 1000
				)} seconds before sending another message. This helps manage API quotas.`,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, rateLimitMessage]);
			return;
		}

		const userMessage: Message = {
			type: "user",
			content: input.trim(),
			timestamp: new Date(),
		};
		setMessages((prev) => [...prev, userMessage]);

		setInput("");
		setIsLoading(true);

		try {
			const structuredResponse = await getStructuredChatResponse(
				`${SYSTEM_INSTRUCTION}\n\nUser question: ${input.trim()}`
			);

			const aiMessage: Message = {
				type: "ai",
				content: structuredResponse.summary,
				timestamp: new Date(),
				structuredResponse,
			};
			setMessages((prev) => [...prev, aiMessage]);
		} catch (error) {
			console.error("Error getting AI response:", error);

			let errorMessage: Message;
			const errorObj = error as Error;

			if (
				errorObj.message?.includes("Rate limit") ||
				errorObj.message?.includes("quota")
			) {
				errorMessage = {
					type: "rate_limit",
					content:
						errorObj.message ||
						"Rate limit exceeded. Please wait before making another request.",
					timestamp: new Date(),
				};
			} else {
				errorMessage = {
					type: "error",
					content:
						"Sorry, I encountered an error while processing your request. Please try again.",
					timestamp: new Date(),
				};
			}

			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	const copyToClipboard = async (message: Message, index: number) => {
		try {
			let textToCopy = message.content;

			if (message.structuredResponse) {
				const sr = message.structuredResponse;
				textToCopy = `${sr.title}\n\n${sr.summary}\n\n`;

				sr.content.forEach((item) => {
					switch (item.type) {
						case "text":
							textToCopy += `${item.content}\n\n`;
							break;
						case "list":
							if (item.title) textToCopy += `${item.title}:\n`;
							item.items?.forEach((listItem) => {
								textToCopy += `• ${listItem}\n`;
							});
							textToCopy += "\n";
							break;
						case "suggestion":
							textToCopy += `Suggestion: ${item.content}\n\n`;
							break;
						case "warning":
							textToCopy += `Warning: ${item.content}\n\n`;
							break;
						case "resource":
							textToCopy += `Resource: ${item.title}\n${item.content}\n${item.url}\n\n`;
							break;
						case "code":
							textToCopy += `Code (${item.language}):\n${item.content}\n\n`;
							break;
					}
				});
			}

			await navigator.clipboard.writeText(textToCopy);
			setCopiedMessageId(index);

			setTimeout(() => {
				setCopiedMessageId(null);
			}, 2000);
		} catch (err) {
			console.error("Failed to copy text: ", err);
		}
	};

	const formatTimestamp = (timestamp: Date) => {
		return timestamp.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const renderResponseItem = (item: ChatResponseItem, index: number) => {
		switch (item.type) {
			case "text":
				return (
					<p key={index} className="mb-4 text-foreground leading-relaxed text-[15px]">
						{item.content}
					</p>
				);

			case "list":
				return (
					<div key={index} className="mb-5">
						{item.title && (
							<h4 className="text-sm font-semibold mb-2.5 text-foreground/90">{item.title}</h4>
						)}
						<ul className="space-y-2">
							{item.items?.map((listItem, i) => (
								<li key={i} className="flex items-start gap-2.5 text-foreground/80 text-[15px]">
									<span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-primary to-secondary mt-2 shrink-0" />
									{listItem}
								</li>
							))}
						</ul>
					</div>
				);

			case "suggestion":
				return (
					<motion.div
						key={index}
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						className="flex items-start gap-3 mb-4 p-4 bg-gradient-to-r from-primary/5 to-secondary/5 border-l-4 border-primary rounded-xl"
					>
						<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
							<HiOutlineLightBulb className="text-white text-lg" />
						</div>
						<p className="text-foreground text-[15px] leading-relaxed">{item.content}</p>
					</motion.div>
				);

			case "warning":
				return (
					<motion.div
						key={index}
						initial={{ opacity: 0, x: -10 }}
						animate={{ opacity: 1, x: 0 }}
						className="flex items-start gap-3 mb-4 p-4 bg-gradient-to-r from-destructive/5 to-destructive/10 border-l-4 border-destructive rounded-xl"
					>
						<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center shrink-0">
							<FiAlertTriangle className="text-destructive text-lg" />
						</div>
						<p className="text-destructive text-[15px] leading-relaxed">
							{item.content}
						</p>
					</motion.div>
				);

			case "resource":
				return (
					<motion.div
						key={index}
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="mb-4 p-4 border border-border rounded-xl bg-card/50 hover:border-primary/50 transition-all duration-300 premium-card-hover"
					>
						<div className="flex items-center gap-3 mb-2">
							<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
								<FiLink className="text-primary text-lg" />
							</div>
							<h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
						</div>
						<p className="text-sm text-muted-foreground mb-3 leading-relaxed">{item.content}</p>
						<a
							href={item.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-2 group transition-colors"
						>
							<span>Visit resource</span>
							<FiLink className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
						</a>
					</motion.div>
				);

			case "code":
				return (
					<motion.div 
						key={index} 
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className="mb-4 relative overflow-hidden rounded-xl border border-border/50 shadow-premium"
					>
						<div className="bg-gradient-to-r from-muted to-muted/50 backdrop-blur-sm px-4 py-2.5 text-xs font-mono flex items-center justify-between border-b border-border/50">
							<div className="flex items-center gap-2">
								<FiCode className="h-4 w-4 text-primary" />
								<span className="font-semibold text-foreground">{item.language || "code"}</span>
							</div>
						</div>
						<pre className="p-4 bg-muted/20 overflow-x-auto">
							<code className="text-sm font-mono text-foreground/90 whitespace-pre leading-relaxed">
								{item.content}
							</code>
						</pre>
					</motion.div>
				);

			default:
				return null;
		}
	};

	return (
		<div className="h-full flex flex-col relative" aria-label="Chat interface">
			{/* Animated Background Gradient */}

			<div
				className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10"
				role="log"
				aria-live="polite"
				aria-label="Chat conversation"
			>
				{messages.length === 0 && (
					<div
						className="flex flex-col items-center justify-center h-full text-center space-y-8"
						aria-label="Welcome to chat"
					>
						<motion.div
							initial={{ scale: 0.8, opacity: 0, y: 20 }}
							animate={{ scale: 1, opacity: 1, y: 0 }}
							transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
							className="relative flex flex-col justify-center items-center"
						>
							
							<div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center mb-6 shadow-premium glow-primary">
								<HiOutlineChatAlt className="text-6xl text-white" />
							</div>
							
							<h2 className="text-3xl font-display font-bold mb-3 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
								Start a Conversation
							</h2>
							<p className="text-base text-muted-foreground max-w-lg mx-auto">
								Ask me anything about Indian legal matters, rights, procedures, or get guidance on your legal questions.
							</p>
							<motion.div 
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.3 }}
								className="mt-4 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-xs text-accent inline-block"
							>
								💡 General legal information only • Not professional legal advice
							</motion.div>
						</motion.div>

						<div className="w-full max-w-3xl space-y-4">
							<p className="text-sm font-semibold text-foreground/80 flex items-center gap-2 justify-center">
								<HiOutlineLightBulb className="text-lg text-primary" />
								Popular Questions
							</p>
							<div className="grid grid-cols-1 gap-3">
								{suggestions.map((suggestion, i) => (
									<motion.div
										key={i}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ 
											delay: 0.1 * i,
											type: "spring",
											stiffness: 100
										}}
									>
										<motion.button
											whileHover={{ scale: 1.02, x: 4 }}
											whileTap={{ scale: 0.98 }}
											onClick={() => {
												setInput(suggestion);
												inputRef.current?.focus();
											}}
											disabled={rateLimitCountdown > 0}
											className="w-full text-left p-4 rounded-2xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 hover:bg-card/80 transition-all duration-300 shadow-sm hover:shadow-premium premium-card-hover group"
										>
											<div className="flex items-start gap-3">
												<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0 group-hover:from-primary/30 group-hover:to-secondary/30 transition-all">
													<span className="text-sm font-bold bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
														{i + 1}
													</span>
												</div>
												<span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors leading-relaxed">
													{suggestion}
												</span>
											</div>
										</motion.button>
									</motion.div>
								))}
							</div>
						</div>
					</div>
				)}

				{messages.length > 0 && (
					<div className="space-y-8 max-w-5xl mx-auto">
						{messages.map((message, index) => (
							<motion.div
								key={index}
								initial={{ opacity: 0, y: 20, scale: 0.95 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{ 
									duration: 0.4,
									ease: [0.16, 1, 0.3, 1],
									delay: 0.05 * index
								}}
								aria-label={`${message.type === "user" ? "You" : "AI"}: ${
									message.content
								}`}
							>
								<div
									className={`flex ${
										message.type === "user" ? "justify-end" : "justify-start"
									}`}
								>
									<div
										className={`flex ${
											message.type === "user" ? "flex-row-reverse" : "flex-row"
										} items-start gap-4 max-w-[90%]`}
									>
										{/* Avatar with premium styling */}
										<motion.div
											whileHover={{ scale: 1.1, rotate: 5 }}
											transition={{ type: "spring", stiffness: 300 }}
										>
											<Avatar className="h-10 w-10 mt-1 border-2 border-border shadow-premium">
												<AvatarFallback
													className={`${
														message.type === "user"
															? "bg-gradient-to-br from-primary to-primary-dark text-white"
														: message.type === "error"
														? "bg-gradient-to-br from-destructive/20 to-destructive/10 text-destructive"
														: message.type === "rate_limit"
														? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-600"
														: "bg-gradient-to-br from-secondary to-accent text-white"
												}`}
												aria-label={
													message.type === "user" ? "Your avatar" : "AI avatar"
												}
											>
												{message.type === "user" ? (
													<FiUser aria-hidden="true" className="text-lg" />
												) : message.type === "error" ? (
													<FiAlertTriangle aria-hidden="true" className="text-lg" />
												) : message.type === "rate_limit" ? (
													<FiClock aria-hidden="true" className="text-lg" />
												) : (
													<FiCpu aria-hidden="true" className="text-lg" />
												)}
											</AvatarFallback>
										</Avatar>
										</motion.div>

										<Card
											className={`py-0 message-bubble shadow-premium backdrop-blur-sm ${
												message.type === "user"
													? "border-primary/30 bg-gradient-to-br from-primary/10 to-primary-dark/5"
													: message.type === "error"
													? "border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5"
													: message.type === "rate_limit"
													? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5"
													: "border-border/50 bg-card/80"
											}`}
										>
											<CardContent className="p-5">
												{message.type === "ai" && (
													<div className="flex justify-between items-center mb-3">
														<Badge
															variant="outline"
															className="text-xs px-2.5 py-0.5 rounded-full border-secondary/30 bg-gradient-to-r from-secondary/10 to-accent/10 text-secondary font-medium"
														>
															✨ AI Assistant
														</Badge>
														{message.timestamp && (
															<span className="text-xs text-muted-foreground font-medium">
																{formatTimestamp(message.timestamp)}
															</span>
														)}
													</div>
												)}

												{message.type === "rate_limit" && (
													<div className="flex justify-between items-center mb-3">
														<Badge
															variant="outline"
															className="text-xs px-2.5 py-0.5 rounded-full border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/10 text-amber-600 font-medium"
														>
															⏱️ Rate Limit
														</Badge>
														{message.timestamp && (
															<span className="text-xs text-muted-foreground font-medium">
																{formatTimestamp(message.timestamp)}
															</span>
														)}
													</div>
												)}

												{message.type === "user" && message.timestamp && (
													<div className="flex justify-end mb-2">
														<span className="text-xs text-muted-foreground/80 font-medium">
															{formatTimestamp(message.timestamp)}
														</span>
													</div>
												)}

												<div
													className={`${
														message.type === "user"
															? "text-primary-900 dark:text-primary-50"
															: message.type === "error"
															? "text-destructive dark:text-destructive"
															: message.type === "rate_limit"
															? "text-amber-800 dark:text-amber-200"
															: "text-foreground"
													}`}
												>
													{message.type === "user" ? (
														<p className="text-sm">{message.content}</p>
													) : message.type === "error" ? (
														<div className="flex items-start gap-2">
															<FiAlertTriangle className="text-destructive mt-0.5 shrink-0" />
															<p className="text-sm">{message.content}</p>
														</div>
													) : message.type === "rate_limit" ? (
														<div className="flex items-start gap-2">
															<FiClock className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
															<p className="text-sm">{message.content}</p>
														</div>
													) : message.structuredResponse ? (
														<div>
															{message.structuredResponse.title && (
																<h3 className="text-base font-medium mb-2">
																	{message.structuredResponse.title}
																</h3>
															)}

															{message.structuredResponse.content.map(
																renderResponseItem
															)}
														</div>
													) : (
														<p className="text-sm">{message.content}</p>
													)}
												</div>

												{message.type === "ai" && (
													<div className="flex justify-end mt-3">
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<motion.button
																		whileHover={{ scale: 1.1 }}
																		whileTap={{ scale: 0.9 }}
																		onClick={() =>
																			copyToClipboard(message, index)
																		}
																		className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
																		aria-label="Copy message to clipboard"
																	>
																		{copiedMessageId === index ? (
																			<FiCheck
																				className="h-4 w-4 text-green-500"
																				aria-hidden="true"
																			/>
																		) : (
																			<FiCopy
																				className="h-4 w-4 text-muted-foreground"
																				aria-hidden="true"
																			/>
																		)}
																	</motion.button>
																</TooltipTrigger>
																<TooltipContent side="bottom" align="end" className="text-xs">
																	{copiedMessageId === index
																		? "✓ Copied!"
																		: "Copy message"}
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												)}
											</CardContent>
										</Card>
									</div>
								</div>
							</motion.div>
						))}
						<div ref={messagesEndRef} />
					</div>
				)}

				{isLoading && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="flex items-start gap-3 max-w-[85%]"
						aria-live="polite"
						aria-label="AI is thinking"
					>
						<Avatar className="h-8 w-8 mt-1 border border-border/40">
							<AvatarFallback className="bg-secondary-400/10 text-secondary-700 dark:text-secondary-400">
								<FiCpu aria-hidden="true" />
							</AvatarFallback>
						</Avatar>
						<Card className="border-border/60 dark:border-border/30 bg-card">
							<CardContent className="p-3 sm:p-4 flex items-center">
								<div className="flex space-x-1.5" aria-hidden="true">
									<motion.span
										animate={{
											opacity: [0.4, 1, 0.4],
											scale: [0.9, 1, 0.9],
											transition: { duration: 1, repeat: Infinity },
										}}
										className="w-2.5 h-2.5 bg-primary/70 dark:bg-secondary-400 rounded-full"
									/>
									<motion.span
										animate={{
											opacity: [0.4, 1, 0.4],
											scale: [0.9, 1, 0.9],
											transition: {
												duration: 1,
												delay: 0.33,
												repeat: Infinity,
											},
										}}
										className="w-2.5 h-2.5 bg-primary/70 dark:bg-secondary-400 rounded-full"
									/>
									<motion.span
										animate={{
											opacity: [0.4, 1, 0.4],
											scale: [0.9, 1, 0.9],
											transition: {
												duration: 1,
												delay: 0.66,
												repeat: Infinity,
											},
										}}
										className="w-2.5 h-2.5 bg-primary/70 dark:bg-secondary-400 rounded-full"
									/>
								</div>
								<span className="ml-2 text-sm text-muted-foreground">
									AI is thinking...
								</span>
							</CardContent>
						</Card>
					</motion.div>
				)}
			</div>

			<div className="mt-auto relative z-10">
				<div className="px-6 pb-6 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
					<form
						onSubmit={handleSubmit}
						className="max-w-4xl mx-auto"
						aria-label="Message input form"
					>
						<div className="relative flex items-center gap-3 premium-input">
							<div className="flex-1 relative">
								<Input
									ref={inputRef}
									type="text"
									placeholder={
										rateLimitCountdown > 0
											? `⏱️ Please wait ${rateLimitCountdown}s...`
											: "Ask me anything about legal matters..."
									}
									value={input}
									onChange={(e) => setInput(e.target.value)}
									autoFocus
									disabled={rateLimitCountdown > 0 || isLoading}
									className="rounded-full h-14 px-6 pr-4 border-2 border-border/50 bg-card/80 backdrop-blur-sm text-base   transition-all duration-300 "
									aria-label="Type your legal question"
								/>
								<motion.div 
									className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2"
								>
									{rateLimitCountdown > 0 && (
										<span className="text-xs font-medium text-amber-600 dark:text-amber-400 px-2">
											{rateLimitCountdown}s
										</span>
									)}
									<motion.button
										type="submit"
										disabled={!input.trim() || isLoading || rateLimitCountdown > 0}
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
											!input.trim() || isLoading || rateLimitCountdown > 0
												? "bg-muted text-muted-foreground cursor-not-allowed"
												: "bg-gradient-to-br from-primary to-secondary text-white shadow-premium hover:shadow-lg glow-primary"
										}`}
										aria-label="Send message"
									>
										{isLoading ? (
											<motion.div
												animate={{ rotate: 360 }}
												transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
											>
												<FiCpu className="h-5 w-5" />
											</motion.div>
										) : rateLimitCountdown > 0 ? (
											<FiClock className="h-5 w-5" aria-hidden="true" />
										) : (
											<FiSend className="h-5 w-5" aria-hidden="true" />
										)}
									</motion.button>
								</motion.div>
							</div>
						</div>
					</form>
					
					<motion.div 
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="mt-6 text-center space-y-2"
					>
						<p className="text-xs text-muted-foreground/80">
							<span className="inline-flex items-center gap-1">
								💡 <span className="font-medium">General legal information only</span> • Not professional legal advice
							</span>
						</p>
						{rateLimitCountdown > 0 && (
							<motion.p 
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								className="text-xs text-amber-600 dark:text-amber-400 font-medium"
							>
								⏱️ Rate limiting active • Helps manage API quotas
							</motion.p>
						)}
					</motion.div>
				</div>
			</div>
		</div>
	);
};

export default ChatInterface;
