EXTRACTION_INSTRUCTION = """
You are a resume parser. Extract ALL information and return ONLY valid JSON.

Return ONLY a JSON object (no markdown, no explanation) matching this exact structure:
{
  "employee_id": "<use the provided employee_id>",
  "personal_info": { "full_name": "..." },
  "profile_summary": "...",
  "total_experience": <integer years>,
  "technical_skills": { "<category>": ["skill1", "skill2"] },
  "work_experience": [
    {
      "designation": "...",
      "duration": "...",
      "company": { "name": "...", "description": "..." },
      "project": {
        "name": "...", "client": "...", "role": "...",
        "environment": ["tech1"],
        "project_description": "...",
        "responsibilities": ["..."]
      }
    }
  ],
  "education": [{ "year": "...", "institution": "...", "stream": "...", "cgpa": 0.0 }],
  "certifications": ["..."],
  "achievements": ["..."],
  "interests": ["..."]
}

Rules:
- total_experience must be an integer
- cgpa must be a float
- All arrays must be arrays even if empty: []
- Return ONLY the JSON object, nothing else
"""
