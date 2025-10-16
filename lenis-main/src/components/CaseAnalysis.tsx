import React, { useState } from "react";
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
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
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
		} catch (error: any) {
			console.error("Error analyzing case:", error);
			setError(error.message || "Failed to analyze case. Please try again.");
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
		<div className="h-full overflow-auto p-2">
			<div className="text-center mb-8">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
					AI-Powered Legal Case Analysis
				</h1>
				<p className="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
					Get comprehensive legal analysis and strategy recommendations powered
					by AI
				</p>
				<div className="mt-4 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg max-w-xl mx-auto">
					⚖️ This provides general legal information only. Consult a qualified
					lawyer for specific legal advice.
				</div>
			</div>

			{/* Rate limit warning */}
			{rateLimitCountdown > 0 && (
				<Alert className="max-w-4xl mx-auto mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
					<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
					<AlertDescription className="text-amber-800 dark:text-amber-200">
						AI analysis will be available in {rateLimitCountdown} seconds due to
						rate limits.
					</AlertDescription>
				</Alert>
			)}

			{/* Error display */}
			{error && (
				<Alert className="max-w-4xl mx-auto mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
					<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
					<AlertDescription className="text-red-800 dark:text-red-200">
						{error}
					</AlertDescription>
				</Alert>
			)}

			<form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
				<div className="grid gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HiOutlineScale className="h-5 w-5" />
								Case Information
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
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
							<div className="space-y-2">
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

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HiOutlineDocumentText className="h-5 w-5" />
								Case Details
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="caseDescription">Case Description *</Label>
								<Textarea
									id="caseDescription"
									name="caseDescription"
									value={formData.caseDescription}
									onChange={handleInputChange}
									placeholder="Provide detailed description of your legal situation, including timeline, parties involved, and key facts..."
									className="min-h-[100px]"
									required
									disabled={isAnalyzing}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="specificQuestion">
									Specific Legal Question *
								</Label>
								<Textarea
									id="specificQuestion"
									name="specificQuestion"
									value={formData.specificQuestion}
									onChange={handleInputChange}
									placeholder="What specific legal guidance do you need? e.g., 'What are my options for resolution?', 'What documents should I prepare?'"
									className="min-h-[80px]"
									required
									disabled={isAnalyzing}
								/>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="flex justify-center">
					<Button
						type="submit"
						size="lg"
						className="flex items-center gap-2"
						disabled={isAnalyzing || rateLimitCountdown > 0}
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
					</Button>
				</div>
			</form>

			{/* Analysis Results */}
			{analysisResult && (
				<div className="mt-12 max-w-4xl mx-auto space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="text-2xl font-bold">AI Legal Analysis Results</h2>
						<Button
							variant="outline"
							size="sm"
							onClick={copyFullAnalysis}
							className="flex items-center gap-2"
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
						</Button>
					</div>

					<div className="grid gap-6 lg:grid-cols-2">
						{/* Summary Card */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Case Summary
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-foreground mb-4">{analysisResult.summary}</p>
								<Badge variant="secondary" className="mb-2">
									{formData.caseType} - {formData.location}
								</Badge>
							</CardContent>
						</Card>

						{/* Legal Assessment */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<HiOutlineScale className="h-5 w-5" />
									Legal Assessment
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-foreground">
									{analysisResult.legalAssessment}
								</p>
							</CardContent>
						</Card>

						{/* Key Issues */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<AlertTriangle className="h-5 w-5" />
									Key Legal Issues
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2">
									{analysisResult.keyIssues.map((issue, index) => (
										<li key={index} className="flex items-start gap-2">
											<span className="text-primary mt-1">•</span>
											<span className="text-foreground">{issue}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>

						{/* Recommended Actions */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<HiOutlineLightBulb className="h-5 w-5" />
									Recommended Actions
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2">
									{analysisResult.recommendedActions.map((action, index) => (
										<li key={index} className="flex items-start gap-2">
											<span className="text-green-600 mt-1">✓</span>
											<span className="text-foreground">{action}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>

						{/* Potential Risks */}
						{analysisResult.potentialRisks.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<AlertTriangle className="h-5 w-5 text-orange-500" />
										Potential Risks
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2">
										{analysisResult.potentialRisks.map((risk, index) => (
											<li key={index} className="flex items-start gap-2">
												<span className="text-orange-500 mt-1">⚠</span>
												<span className="text-foreground">{risk}</span>
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						)}

						{/* Next Steps */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Gavel className="h-5 w-5" />
									Next Steps
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-2">
									{analysisResult.nextSteps.map((step, index) => (
										<li key={index} className="flex items-start gap-2">
											<span className="text-blue-600 mt-1">{index + 1}.</span>
											<span className="text-foreground">{step}</span>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					</div>

					{/* Legal Disclaimer */}
					<Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
						<CardContent className="pt-6">
							<div className="flex items-start gap-3">
								<AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
								<div>
									<h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
										Important Legal Disclaimer
									</h4>
									<p className="text-sm text-yellow-700 dark:text-yellow-300">
										This AI-generated analysis provides general legal
										information only and is not a substitute for professional
										legal advice. Laws vary by jurisdiction and individual
										circumstances. Always consult with a qualified lawyer
										licensed to practice in your jurisdiction for specific legal
										advice regarding your situation.
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Empty state when no results */}
			{!analysisResult && !isAnalyzing && (
				<div className="mt-12 text-center">
					<Card>
						<CardContent className="pt-6">
							<Gavel className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
							<h3 className="text-xl font-semibold mb-2">
								AI Legal Analysis Ready
							</h3>
							<p className="text-muted-foreground">
								Fill out the form above and submit to get comprehensive
								AI-powered legal analysis and recommendations for your case.
							</p>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
};

export default CaseAnalysis;
