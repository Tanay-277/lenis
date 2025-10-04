import React, { useState } from "react";
import { motion } from "framer-motion";
import {
	HiOutlineScale,
	HiOutlineDocumentText,
	HiOutlineLightBulb,
} from "react-icons/hi";
import {
	Gavel,
	AlertTriangle,
	Clock,
	Copy,
	Check,
	FileText,
	Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";

import {
	getStructuredChatResponse,
	StructuredChatResponse,
	canMakeRequest,
	getTimeUntilNextRequest,
} from "../utils/gemini";
import AutocompleteInput from "./AutoComplete";

interface CaseAnalysisResult {
	title: string;
	summary: string;
	legalAssessment: string;
	keyIssues: string[];
	recommendedActions: string[];
	potentialRisks: string[];
	estimatedCosts: string;
	timeline: string;
	nextSteps: string[];
}

// Add options for Case Type and Location here
const caseTypeOptions = [
	"Contract Dispute",
	"Property Case",
	"Consumer Complaint",
	"Criminal",
	"Family Law",
	"Labor",
	"Environmental",
];

const locationOptions = [
	"Mumbai",
	"Delhi High Court",
	"Kerala",
	"Karnataka",
	"Supreme Court of India",
	"Chennai",
	"Bengaluru",
];

const CaseAnalysis = () => {
	const [formData, setFormData] = useState({
		caseType: "",
		location: "",
		caseDescription: "",
		specificQuestion: "",
	});

	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisResult, setAnalysisResult] =
		useState<CaseAnalysisResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copiedSection, setCopiedSection] = useState<string | null>(null);
	const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

	// Check rate limit status
	React.useEffect(() => {
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

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));

		// Clear error when user starts typing
		if (error) setError(null);
	};

	const parseLegalResponse = (
		response: StructuredChatResponse
	): CaseAnalysisResult => {
		// Extract information from the structured response
		let legalAssessment = "";
		let keyIssues: string[] = [];
		let recommendedActions: string[] = [];
		let potentialRisks: string[] = [];
		let nextSteps: string[] = [];
		const estimatedCosts = "Consult with a lawyer for cost estimates";
		const timeline = "Timeline depends on case complexity";

		response.content.forEach((item) => {
			switch (item.type) {
				case "text":
					if (!legalAssessment) {
						legalAssessment = item.content;
					}
					break;
				case "list":
					if (item.title?.toLowerCase().includes("issue")) {
						keyIssues = item.items || [];
					} else if (
						item.title?.toLowerCase().includes("action") ||
						item.title?.toLowerCase().includes("step")
					) {
						recommendedActions = item.items || [];
					} else if (item.title?.toLowerCase().includes("risk")) {
						potentialRisks = item.items || [];
					} else if (item.title?.toLowerCase().includes("next")) {
						nextSteps = item.items || [];
					} else {
						// Default to recommended actions if unclear
						recommendedActions = item.items || [];
					}
					break;
				case "suggestion":
					recommendedActions.push(item.content);
					break;
			}
		});

		// Set defaults if arrays are empty
		if (keyIssues.length === 0) {
			keyIssues = ["Legal analysis requires more specific case details"];
		}
		if (recommendedActions.length === 0) {
			recommendedActions = [
				"Consult with a qualified lawyer for detailed guidance",
			];
		}
		if (nextSteps.length === 0) {
			nextSteps = [
				"Gather relevant documents",
				"Consult with a lawyer",
				"Consider alternative dispute resolution",
			];
		}

		return {
			title: response.title,
			summary: response.summary,
			legalAssessment,
			keyIssues,
			recommendedActions,
			potentialRisks:
				potentialRisks.length > 0
					? potentialRisks
					: ["Risk assessment requires detailed case review"],
			estimatedCosts,
			timeline,
			nextSteps,
		};
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Check if all required fields are filled
		if (
			!formData.caseType ||
			!formData.location ||
			!formData.caseDescription ||
			!formData.specificQuestion
		) {
			setError("Please fill in all required fields");
			return;
		}

		// Check rate limits
		if (!canMakeRequest()) {
			setError(
				`Rate limit active. Please wait ${rateLimitCountdown} seconds before submitting.`
			);
			return;
		}

		setIsAnalyzing(true);
		setError(null);
		setAnalysisResult(null);

		try {
			// Construct detailed prompt for legal analysis
			const analysisPrompt = `
Analyze this legal case for Indian jurisdiction:

Case Type: ${formData.caseType}
Location/Jurisdiction: ${formData.location}
Case Description: ${formData.caseDescription}
Specific Legal Question: ${formData.specificQuestion}

Please provide a comprehensive legal analysis including:
1. Assessment of the legal situation
2. Key legal issues involved
3. Recommended actions and legal strategies
4. Potential risks and challenges
5. Next steps to take

Focus on Indian laws and procedures. Emphasize this is general guidance only.
`;

			const response = await getStructuredChatResponse(analysisPrompt);
			const analysisResult = parseLegalResponse(response);

			setAnalysisResult(analysisResult);
		} catch (error) {
			console.error("Error analyzing case:", error);
			setError(
				(error as Error).message || "Failed to analyze case. Please try again."
			);
		} finally {
			setIsAnalyzing(false);
		}
	};

	const copyToClipboard = async (text: string, section: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedSection(section);
			setTimeout(() => setCopiedSection(null), 2000);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	const copyFullAnalysis = async () => {
		if (!analysisResult) return;

		const fullText = `
LEGAL CASE ANALYSIS

Case: ${formData.caseType}
Location: ${formData.location}

SUMMARY:
${analysisResult.summary}

LEGAL ASSESSMENT:
${analysisResult.legalAssessment}

KEY LEGAL ISSUES:
${analysisResult.keyIssues.map((issue) => `• ${issue}`).join("\n")}

RECOMMENDED ACTIONS:
${analysisResult.recommendedActions.map((action) => `• ${action}`).join("\n")}

POTENTIAL RISKS:
${analysisResult.potentialRisks.map((risk) => `• ${risk}`).join("\n")}

NEXT STEPS:
${analysisResult.nextSteps.map((step) => `• ${step}`).join("\n")}

DISCLAIMER: This is general legal information only, not specific legal advice. Consult a qualified lawyer for professional guidance.
		`.trim();

		await copyToClipboard(fullText, "full");
	};

	return (
		<div className="h-full overflow-auto px-4 py-6">
			<div className="text-center mb-12 max-w-4xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6 }}
				>
					<h1 className="text-4xl font-display font-bold mb-4 bg-gradient-to-r from-secondary via-accent to-primary bg-clip-text text-transparent">
						AI Case Analysis
					</h1>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
						Comprehensive legal evaluation powered by advanced AI • Get
						strategic insights and recommendations
					</p>
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.2 }}
						className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 text-sm text-accent font-medium"
					>
						⚖️ General legal information • Not professional legal advice
					</motion.div>
				</motion.div>
			</div>

			{/* Rate limit warning */}
			{rateLimitCountdown > 0 && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="max-w-4xl mx-auto mb-8"
				>
					<Alert className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 backdrop-blur-sm shadow-premium">
						<Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
						<AlertDescription className="text-amber-800 dark:text-amber-200 font-medium">
							⏱️ AI analysis available in {rateLimitCountdown} seconds •
							Managing API quotas
						</AlertDescription>
					</Alert>
				</motion.div>
			)}

			{/* Error display */}
			{error && (
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="max-w-4xl mx-auto mb-8"
				>
					<Alert className="border-destructive/30 bg-gradient-to-r from-destructive/10 to-destructive/5 backdrop-blur-sm shadow-premium">
						<AlertTriangle className="h-5 w-5 text-destructive" />
						<AlertDescription className="text-destructive font-medium">
							{error}
						</AlertDescription>
					</Alert>
				</motion.div>
			)}

			<form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
				<div className="grid gap-8 lg:grid-cols-1">
					<motion.div
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.1 }}
					>
						<Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-premium premium-card-hover">
							<CardHeader className="border-b border-border/50 pb-4">
								<CardTitle className="flex items-center gap-3 text-lg">
									<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
										<HiOutlineScale className="h-5 w-5 text-secondary" />
									</div>
									Case Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-3">
									<AutocompleteInput
										id="caseType"
										name="caseType"
										label="Case Type"
										value={formData.caseType}
										onChange={handleInputChange}
										options={caseTypeOptions}
										placeholder="e.g., Contract Dispute, Property Case, Consumer Complaint"
										disabled={isAnalyzing}
										required
									/>
								</div>
								<div className="space-y-3">
									<AutocompleteInput
										id="location"
										name="location"
										label="Location/Jurisdiction"
										value={formData.location}
										onChange={handleInputChange}
										options={locationOptions}
										placeholder="e.g., Mumbai, Delhi High Court, Kerala"
										disabled={isAnalyzing}
										required
									/>
								</div>
							</CardContent>
						</Card>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.2 }}
					>
						<Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-premium premium-card-hover">
							<CardHeader className="border-b border-border/50 pb-4">
								<CardTitle className="flex items-center gap-3 text-lg">
									<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
										<HiOutlineDocumentText className="h-5 w-5 text-primary" />
									</div>
									Case Details
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="space-y-3">
									<Label
										htmlFor="caseDescription"
										className="text-base font-medium"
									>
										Case Description *
									</Label>
									<Textarea
										id="caseDescription"
										name="caseDescription"
										value={formData.caseDescription}
										onChange={handleInputChange}
										placeholder="Provide detailed description of your legal situation, including timeline, parties involved, and key facts..."
										className="min-h-[120px] rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
										required
										disabled={isAnalyzing}
									/>
								</div>
								<div className="space-y-3">
									<Label
										htmlFor="specificQuestion"
										className="text-base font-medium"
									>
										Specific Legal Question *
									</Label>
									<Textarea
										id="specificQuestion"
										name="specificQuestion"
										value={formData.specificQuestion}
										onChange={handleInputChange}
										placeholder="What specific legal guidance do you need? e.g., 'What are my options for resolution?', 'What documents should I prepare?'"
										className="min-h-[100px] rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
										required
										disabled={isAnalyzing}
									/>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				</div>

				<motion.div
					className="flex justify-center"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
				>
					<motion.button
						type="submit"
						className="h-14 px-10 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent text-white font-semibold text-lg shadow-premium glow-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
						disabled={isAnalyzing || rateLimitCountdown > 0}
						whileHover={{ scale: 1.02, y: -2 }}
						whileTap={{ scale: 0.98 }}
					>
						{isAnalyzing ? (
							<>
								<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
								Analyzing Case...
							</>
						) : (
							<>
								<Gavel className="h-5 w-5" />
								Analyze Case with AI
							</>
						)}
					</motion.button>
				</motion.div>
			</form>

			{/* Analysis Results */}
			{analysisResult && (
				<motion.div
					className="mt-16 max-w-5xl mx-auto space-y-8"
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
				>
					<div className="flex items-center justify-between pb-4 border-b border-border/50">
						<h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-3">
							<div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
								<Sparkles className="h-6 w-6 text-primary" />
							</div>
							AI Legal Analysis Results
						</h2>
						<motion.button
							onClick={copyFullAnalysis}
							className="h-11 px-6 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-all flex items-center gap-2 font-medium shadow-premium"
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
						>
							{copiedSection === "full" ? (
								<>
									<Check className="h-4 w-4 text-green-500" /> Copied!
								</>
							) : (
								<>
									<Copy className="h-4 w-4" /> Copy Full Analysis
								</>
							)}
						</motion.button>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						{/* Summary Card */}
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.5 }}
						>
							<Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm shadow-premium premium-card-hover h-full">
								<CardHeader className="border-b border-primary/20 pb-4">
									<CardTitle className="flex items-center gap-3 text-lg">
										<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/20 flex items-center justify-center">
											<FileText className="h-5 w-5 text-primary" />
										</div>
										Case Summary
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-6 space-y-4">
									<p className="text-foreground/90 leading-relaxed">
										{analysisResult.summary}
									</p>
									<Badge
										variant="secondary"
										className="rounded-lg px-4 py-1.5 bg-gradient-to-r from-secondary/20 to-accent/20 border-secondary/30"
									>
										{formData.caseType} • {formData.location}
									</Badge>
								</CardContent>
							</Card>
						</motion.div>

						{/* Legal Assessment */}
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.6 }}
						>
							<Card className="border-secondary/30 bg-gradient-to-br from-secondary/5 to-secondary/10 backdrop-blur-sm shadow-premium premium-card-hover h-full">
								<CardHeader className="border-b border-secondary/20 pb-4">
									<CardTitle className="flex items-center gap-3 text-lg">
										<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/30 to-secondary/20 flex items-center justify-center">
											<HiOutlineScale className="h-5 w-5 text-secondary" />
										</div>
										Legal Assessment
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-6">
									<p className="text-foreground/90 leading-relaxed">
										{analysisResult.legalAssessment}
									</p>
								</CardContent>
							</Card>
						</motion.div>

						{/* Key Issues */}
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.7 }}
						>
							<Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-destructive/10 backdrop-blur-sm shadow-premium premium-card-hover h-full">
								<CardHeader className="border-b border-destructive/20 pb-4">
									<CardTitle className="flex items-center gap-3 text-lg">
										<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive/30 to-destructive/20 flex items-center justify-center">
											<AlertTriangle className="h-5 w-5 text-destructive" />
										</div>
										Key Legal Issues
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-6">
									<ul className="space-y-3">
										{analysisResult.keyIssues.map((issue, index) => (
											<li key={index} className="flex items-start gap-3 group">
												<span className="w-6 h-6 rounded-lg bg-destructive/20 flex items-center justify-center text-destructive font-semibold text-sm flex-shrink-0 mt-0.5">
													{index + 1}
												</span>
												<span className="text-foreground/90 leading-relaxed">
													{issue}
												</span>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						</motion.div>

						{/* Recommended Actions */}
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.8 }}
						>
							<Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 backdrop-blur-sm shadow-premium premium-card-hover h-full">
								<CardHeader className="border-b border-accent/20 pb-4">
									<CardTitle className="flex items-center gap-3 text-lg">
										<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/20 flex items-center justify-center">
											<HiOutlineLightBulb className="h-5 w-5 text-accent" />
										</div>
										Recommended Actions
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-6">
									<ul className="space-y-3">
										{analysisResult.recommendedActions.map((action, index) => (
											<li key={index} className="flex items-start gap-3 group">
												<div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0 mt-0.5">
													✓
												</div>
												<span className="text-foreground/90 leading-relaxed">
													{action}
												</span>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						</motion.div>
					</div>

					{/* Full Width Cards */}
					<div className="space-y-6">
						{/* Potential Risks */}
						{analysisResult.potentialRisks.length > 0 && (
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.9 }}
							>
								<Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-orange-600/10 backdrop-blur-sm shadow-premium premium-card-hover">
									<CardHeader className="border-b border-orange-500/20 pb-4">
										<CardTitle className="flex items-center gap-3 text-lg">
											<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/30 to-orange-600/20 flex items-center justify-center">
												<AlertTriangle className="h-5 w-5 text-orange-500" />
											</div>
											Potential Risks & Considerations
										</CardTitle>
									</CardHeader>
									<CardContent className="pt-6">
										<ul className="space-y-3">
											{analysisResult.potentialRisks.map((risk, index) => (
												<li key={index} className="flex items-start gap-3">
													<div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0 mt-0.5">
														⚠
													</div>
													<span className="text-foreground/90 leading-relaxed">
														{risk}
													</span>
												</li>
											))}
										</ul>
									</CardContent>
								</Card>
							</motion.div>
						)}

						{/* Next Steps */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 1.0 }}
						>
							<Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 backdrop-blur-sm shadow-premium premium-card-hover">
								<CardHeader className="border-b border-primary/20 pb-4">
									<CardTitle className="flex items-center gap-3 text-lg">
										<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center">
											<Gavel className="h-5 w-5 text-primary" />
										</div>
										Next Steps & Recommendations
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-6">
									<ul className="space-y-3">
										{analysisResult.nextSteps.map((step, index) => (
											<li key={index} className="flex items-start gap-3 group">
												<div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center text-primary font-bold flex-shrink-0 mt-0.5">
													{index + 1}
												</div>
												<span className="text-foreground/90 leading-relaxed">
													{step}
												</span>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						</motion.div>

						{/* Legal Disclaimer */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 1.1 }}
						>
							<Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-600/10 backdrop-blur-sm shadow-premium">
								<CardContent className="pt-6">
									<div className="flex items-start gap-4">
										<div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
											<AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
										</div>
										<div className="flex-1">
											<h4 className="font-bold text-lg text-amber-800 dark:text-amber-200 mb-3">
												⚖️ Important Legal Disclaimer
											</h4>
											<p className="text-amber-700 dark:text-amber-300 leading-relaxed">
												This AI-generated analysis provides general legal
												information only and is{" "}
												<strong>
													not a substitute for professional legal advice
												</strong>
												. Laws vary by jurisdiction and individual
												circumstances. Always consult with a qualified lawyer
												licensed to practice in your jurisdiction for specific
												legal advice regarding your situation.
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					</div>
				</motion.div>
			)}

			{/* Empty state when no results */}
			{!analysisResult && !isAnalyzing && (
				<motion.div
					className="mt-16 text-center max-w-2xl mx-auto"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
				>
					<Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-premium">
						<CardContent className="py-16 px-8">
							<motion.div
								animate={{
									rotate: [0, 5, -5, 0],
									scale: [1, 1.05, 1],
								}}
								transition={{
									duration: 3,
									repeat: Infinity,
									repeatType: "reverse",
								}}
								className="inline-block"
							>
								<div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center mx-auto mb-8 shadow-premium">
									<Gavel className="h-12 w-12 text-primary" />
								</div>
							</motion.div>
							<h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
								AI Legal Analysis Ready
							</h3>
							<p className="text-muted-foreground text-lg leading-relaxed">
								Fill out the form above and submit to receive comprehensive
								AI-powered legal analysis, recommendations, and next steps for
								your case.
							</p>
						</CardContent>
					</Card>
				</motion.div>
			)}
		</div>
	);
};

export default CaseAnalysis;
