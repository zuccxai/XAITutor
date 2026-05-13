"""Built-in capability class paths."""

BUILTIN_CAPABILITY_CLASSES: dict[str, str] = {
    "chat": "deeptutor.capabilities.chat:ChatCapability",
    "deep_solve": "deeptutor.capabilities.deep_solve:DeepSolveCapability",
    "photo_solve": "deeptutor.capabilities.photo_solve:PhotoSolveCapability",
    "deep_guided": "deeptutor.capabilities.deep_guided:DeepGuidedCapability",
    "deep_question": "deeptutor.capabilities.deep_question:DeepQuestionCapability",
    "deep_research": "deeptutor.capabilities.deep_research:DeepResearchCapability",
    "competition_consulting": (
        "deeptutor.capabilities.competition_consulting:CompetitionConsultingCapability"
    ),
    "math_animator": "deeptutor.capabilities.math_animator:MathAnimatorCapability",
    "visualize": "deeptutor.capabilities.visualize:VisualizeCapability",
}
