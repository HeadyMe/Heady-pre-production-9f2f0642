#!/usr/bin/env python3
"""
SOFRATES: The Dialectician - Socratic Dialogue Engine
Transforms user queries into sequences of clarifying questions
Integrates with Heady's Sacred Geometry philosophy of organic interfaces
"""

import json
import asyncio
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class DialogueMode(Enum):
    EXPLORATORY = "exploratory"
    CRITICAL = "critical"
    CREATIVE = "creative"
    ETHICAL = "ethical"
    TECHNICAL = "technical"

@dataclass
class SocraticQuestion:
    text: str
    category: str
    depth_level: int
    expected_answer_type: str
    follow_up_potential: float

@dataclass
class DialogueSession:
    session_id: str
    user_id: str
    hypothesis: Optional[str]
    questions_asked: List[SocraticQuestion]
    insights_gained: List[str]
    current_depth: int
    mode: DialogueMode
    created_at: datetime
    updated_at: datetime

class SocraticDialogue:
    def __init__(self):
        self.active_sessions = {}
        self.question_templates = self._load_question_templates()
        self.insight_patterns = self._load_insight_patterns()
        
    def _load_question_templates(self) -> Dict[str, List[str]]:
        """Load Socratic question templates for different contexts"""
        return {
            "assumption_testing": [
                "What assumption are we making about {topic}?",
                "How would our conclusion change if {assumption} were false?",
                "What evidence supports our assumption about {topic}?",
                "What would happen if the opposite of {assumption} were true?"
            ],
            "perspective_shifting": [
                "How might someone with completely different values view {topic}?",
                "What would {role} say about this situation?",
                "How does this look from a 10-year perspective? A 100-year perspective?",
                "What would we think about this if we were from another culture?"
            ],
            "consequence_exploration": [
                "What are the immediate consequences of {action}?",
                "What might happen 6 months from now if we proceed?",
                "Who benefits and who might be harmed by this decision?",
                "What second-order effects might emerge?"
            ],
            "alternative_generation": [
                "What's the simplest way to achieve {goal}?",
                "How could we accomplish this with half the resources?",
                "What would we do if time weren't a constraint?",
                "What's the most radical approach to {problem}?"
            ],
            "clarification": [
                "What do we mean by {term}?",
                "Can you give an example of {concept}?",
                "How is {term} different from {similar_term}?",
                "What would make us certain about {claim}?"
            ]
        }
    
    def _load_insight_patterns(self) -> List[str]:
        """Patterns that indicate insights are emerging"""
        return [
            "contradiction_identified",
            "assumption_challenged", 
            "new_perspective_gained",
            "simplification_found",
            "underlying_principle_discovered",
            "ethical_dilemma_resolved",
            "creative_solution_emerged"
        ]
    
    async def start_dialogue(self, user_id: str, initial_query: str, mode: DialogueMode = DialogueMode.EXPLORATORY) -> DialogueSession:
        """Start a new Socratic dialogue session"""
        session_id = str(uuid.uuid4())
        
        session = DialogueSession(
            session_id=session_id,
            user_id=user_id,
            hypothesis=None,
            questions_asked=[],
            insights_gained=[],
            current_depth=0,
            mode=mode,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        self.active_sessions[session_id] = session
        
        # Generate initial clarifying questions
        initial_questions = await self.generate_questions(initial_query, session)
        session.questions_asked.extend(initial_questions)
        
        return session
    
    async def generate_questions(self, context: str, session: DialogueSession) -> List[SocraticQuestion]:
        """Generate Socratic questions based on context and session state"""
        questions = []
        
        # Analyze context for key themes
        themes = self._extract_themes(context)
        
        # Generate questions based on depth and mode
        if session.current_depth == 0:
            # Initial exploration questions
            questions.extend(self._generate_initial_questions(themes, session.mode))
        elif session.current_depth < 3:
            # Deeper probing questions
            questions.extend(self._generate_probing_questions(themes, session))
        else:
            # Synthesis and insight questions
            questions.extend(self._generate_synthesis_questions(themes, session))
        
        return questions[:3]  # Limit to 3 questions per turn
    
    def _extract_themes(self, text: str) -> List[str]:
        """Extract key themes from user input"""
        # Simple keyword extraction (could be enhanced with NLP)
        themes = []
        
        # Technical indicators
        if any(word in text.lower() for word in ['code', 'system', 'architecture', 'deploy']):
            themes.append('technical')
        
        # Decision indicators
        if any(word in text.lower() for word in ['should', 'decide', 'choose', 'implement']):
            themes.append('decision')
        
        # Problem indicators
        if any(word in text.lower() for word in ['problem', 'issue', 'bug', 'error']):
            themes.append('problem_solving')
        
        # Ethical indicators
        if any(word in text.lower() for word in ['ethical', 'moral', 'fair', 'just']):
            themes.append('ethical')
        
        # Creative indicators
        if any(word in text.lower() for word in ['create', 'design', 'innovate', 'imagine']):
            themes.append('creative')
        
        return themes
    
    def _generate_initial_questions(self, themes: List[str], mode: DialogueMode) -> List[SocraticQuestion]:
        """Generate initial clarifying questions"""
        questions = []
        
        for theme in themes:
            if theme == 'technical':
                questions.append(SocraticQuestion(
                    text="What technical constraint are we working within?",
                    category="clarification",
                    depth_level=1,
                    expected_answer_type="constraint",
                    follow_up_potential=0.8
                ))
            elif theme == 'decision':
                questions.append(SocraticQuestion(
                    text="What outcome are we ultimately trying to achieve?",
                    category="clarification", 
                    depth_level=1,
                    expected_answer_type="goal",
                    follow_up_potential=0.9
                ))
            elif theme == 'ethical':
                questions.append(SocraticQuestion(
                    text="Who might be affected by this decision?",
                    category="consequence_exploration",
                    depth_level=1,
                    expected_answer_type="stakeholder",
                    follow_up_potential=0.8
                ))
        
        return questions
    
    def _generate_probing_questions(self, themes: List[str], session: DialogueSession) -> List[SocraticQuestion]:
        """Generate deeper probing questions"""
        questions = []
        
        for theme in themes:
            if theme == 'technical':
                questions.append(SocraticQuestion(
                    text="How might we simplify this technical approach?",
                    category="alternative_generation",
                    depth_level=2,
                    expected_answer_type="simplification",
                    follow_up_potential=0.7
                ))
            elif theme == 'decision':
                questions.append(SocraticQuestion(
                    text="What would happen if we did the opposite?",
                    category="perspective_shifting",
                    depth_level=2,
                    expected_answer_type="alternative",
                    follow_up_potential=0.8
                ))
        
        return questions
    
    def _generate_synthesis_questions(self, themes: List[str], session: DialogueSession) -> List[SocraticQuestion]:
        """Generate synthesis and insight questions"""
        questions = []
        
        questions.append(SocraticQuestion(
            text="What pattern connects all the insights we've discovered?",
            category="synthesis",
            depth_level=3,
            expected_answer_type="pattern",
            follow_up_potential=0.9
        ))
        
        return questions
    
    async def process_response(self, session_id: str, user_response: str) -> Tuple[List[SocraticQuestion], List[str]]:
        """Process user response and generate follow-up questions"""
        session = self.active_sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Analyze response for insights
        insights = self._extract_insights(user_response, session)
        session.insights_gained.extend(insights)
        
        # Update session
        session.current_depth += 1
        session.updated_at = datetime.now()
        
        # Generate follow-up questions
        follow_up_questions = await self.generate_questions(user_response, session)
        session.questions_asked.extend(follow_up_questions)
        
        return follow_up_questions, insights
    
    def _extract_insights(self, response: str, session: DialogueSession) -> List[str]:
        """Extract insights from user response"""
        insights = []
        
        # Look for pattern indicators
        response_lower = response.lower()
        
        if "realize" in response_lower or "notice" in response_lower:
            insights.append("new_awareness")
        
        if "contradiction" in response_lower or "conflict" in response_lower:
            insights.append("contradiction_identified")
        
        if "simpler" in response_lower or "easier" in response_lower:
            insights.append("simplification_found")
        
        if "actually" in response_lower or "really" in response_lower:
            insights.append("assumption_challenged")
        
        return insights
    
    async def conclude_dialogue(self, session_id: str) -> Dict:
        """Conclude dialogue and provide synthesis"""
        session = self.active_sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Generate synthesis
        synthesis = self._generate_synthesis(session)
        
        # Create summary
        summary = {
            session_id: session_id,
            user_id: session.user_id,
            duration_minutes: (datetime.now() - session.created_at).total_seconds() / 60,
            questions_asked: len(session.questions_asked),
            insights_gained: session.insights_gained,
            synthesis: synthesis,
            hypothesis: session.hypothesis,
            mode: session.mode.value
        }
        
        # Remove from active sessions
        del self.active_sessions[session_id]
        
        return summary
    
    def _generate_synthesis(self, session: DialogueSession) -> str:
        """Generate synthesis of dialogue insights"""
        if not session.insights_gained:
            return "The dialogue explored initial assumptions but deeper insights are still emerging."
        
        insight_summary = ", ".join(set(session.insights_gained))
        
        synthesis_templates = {
            "contradiction_identified": "We discovered a fundamental contradiction that suggests rethinking our approach.",
            "assumption_challenged": "A key assumption was challenged, opening new possibilities.",
            "simplification_found": "We found a simpler path forward that reduces complexity.",
            "new_awareness": "New awareness emerged that changes our understanding of the situation."
        }
        
        synthesis_parts = []
        for insight in set(session.insights_gained):
            if insight in synthesis_templates:
                synthesis_parts.append(synthesis_templates[insight])
        
        return " ".join(synthesis_parts) if synthesis_parts else "The dialogue revealed valuable insights for further exploration."
    
    def get_active_sessions(self, user_id: Optional[str] = None) -> List[DialogueSession]:
        """Get active dialogue sessions"""
        sessions = list(self.active_sessions.values())
        if user_id:
            sessions = [s for s in sessions if s.user_id == user_id]
        return sessions
    
    def get_session_stats(self) -> Dict:
        """Get statistics about dialogue sessions"""
        total_sessions = len(self.active_sessions)
        avg_depth = sum(s.current_depth for s in self.active_sessions.values()) / total_sessions if total_sessions > 0 else 0
        
        mode_counts = {}
        for session in self.active_sessions.values():
            mode = session.mode.value
            mode_counts[mode] = mode_counts.get(mode, 0) + 1
        
        return {
            active_sessions: total_sessions,
            average_depth: avg_depth,
            mode_distribution: mode_counts,
            total_insights_generated: sum(len(s.insights_gained) for s in self.active_sessions.values())
        }

# Integration with Heady Systems
class HeadySocraticIntegration:
    def __init__(self):
        self.socratic = SocraticDialogue()
        
    async def handle_user_query(self, user_id: str, query: str, mode: str = "exploratory") -> Dict:
        """Handle user query with Socratic method"""
        try:
            dialogue_mode = DialogueMode(mode.lower())
            
            # Start or continue dialogue
            active_sessions = self.socratic.get_active_sessions(user_id)
            
            if active_sessions:
                # Continue existing session
                session = active_sessions[0]
                questions, insights = await self.socratic.process_response(session.session_id, query)
            else:
                # Start new dialogue
                session = await self.socratic.start_dialogue(user_id, query, dialogue_mode)
                questions = session.questions_asked
                insights = []
            
            return {
                session_id: session.session_id,
                questions: [q.text for q in questions],
                insights: insights,
                depth: session.current_depth,
                mode: session.mode.value,
                guidance: "Please reflect on these questions to deepen your understanding."
            }
            
        except Exception as e:
            return {
                error: f"Socratic dialogue error: {str(e)}",
                fallback_direct_answer: await self.generate_fallback_answer(query)
            }
    
    async def generate_fallback_answer(self, query: str) -> str:
        """Generate direct answer if Socratic method fails"""
        # This would integrate with Claude or other AI models
        return f"I understand you're asking about: {query}. Let me provide a direct response while the Socratic system recalibrates."

# Export for integration
if __name__ == "__main__":
    integration = HeadySocraticIntegration()
    
    # Example usage
    async def example():
        result = await integration.handle_user_query(
            user_id="heady_user_001",
            query="Should I implement this new feature?",
            mode="critical"
        )
        print(json.dumps(result, indent=2))
    
    asyncio.run(example())
