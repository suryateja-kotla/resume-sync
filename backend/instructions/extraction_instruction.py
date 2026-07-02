EXTRACTION_INSTRUCTION = """
You are a resume parser. Extract ALL information from the resume and return ONLY valid JSON.

Return ONLY a JSON object (no markdown, no code fences, no explanation) with this exact structure:
{
  "employee_id": "<use the provided employee_id>",
  "personal_info": { "full_name": "..." },
  "profile_summary": "...",
  "total_experience": <number, float ok e.g. 1.5>,
  "technical_skills": { "<category_name>": ["skill1", "skill2"] },
  "work_experience": [
    {
      "designation": "Job title held at the company",
      "duration": "e.g. Jan 2021 – Till Date",
      "company": {
        "name": "Employer company name",
        "description": "Company description if present, else empty string"
      },
      "project": {
        "name": "Project or product name",
        "client": "Client name (from Client row in project table, or 'Internal')",
        "role": "Role in the project (from Role row in project table)",
        "environment": ["tech1", "tech2"],
        "project_description": "Project description paragraph if present, else empty string",
        "responsibilities": [
          "Each responsibility bullet as a separate string — do NOT merge bullets into one string"
        ]
      }
    }
  ],
  "education": [{ "year": "...", "institution": "...", "stream": "...", "cgpa": 0.0 }],
  "certifications": ["..."],
  "achievements": ["..."],
  "interests": ["..."]
}

Critical rules:
- For technical_skills:
  - If the resume already has named skill categories, preserve every category name exactly as written and keep each category's skills exactly as listed. Do NOT merge, rename, or reorganize categories — each category in the resume must appear as its own key in technical_skills.
  - If the resume has a flat ungrouped skill list under a single heading (e.g. "Technical Skills" with no sub-categories), intelligently group the skills into standard categories such as: "Programming Languages", "Frameworks / Libraries", "Databases", "Tools", "Cloud Technologies", "Operating Systems". Place each skill under the most appropriate category. Never put all skills under one key like "technologies" or "skills".
- Extract EVERY responsibility bullet as a SEPARATE string in the responsibilities array. Never join bullets with commas or newlines into a single string.
- Extract EVERY work experience entry — do not skip older roles.
- For each work experience:
  - If the resume has a project table with rows labeled Project, Client, Role, Environment: map those to project.name, project.client, project.role, project.environment.
  - If the resume has NO dedicated project table (e.g. responsibilities are listed directly under the job title): set project.name to the job/project title if one is mentioned, otherwise use the designation as project.name. Set project.client to the company name. Set project.role to the designation. Extract all responsibility bullets into project.responsibilities. NEVER leave project.name as an empty string — always use designation as the fallback.
  - Extract any project description paragraph (what the project/product does) into project.project_description.
  - Extract the tech stack / technologies mentioned under each role into project.environment as an array.
- total_experience must be a number (float allowed, e.g. 1.5 for 18 months).
- cgpa must be a float.
- All arrays must be arrays even if empty: [].
- Sort work_experience with the most recent role first (ongoing/Till Date roles come first).
- For achievements: copy every achievement, award, recognition, and project entry EXACTLY as written in the resume — word for word, including all impact lines, metrics, and descriptions. Do NOT summarize, paraphrase, condense, or reword anything. Each distinct achievement or project entry should be one string in the array.
- For certifications: copy each certification exactly as written, including issuer and date if present.
- For interests: copy each item exactly as written.
- Return ONLY the JSON object, nothing else.
"""
