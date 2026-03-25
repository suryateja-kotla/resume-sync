from datetime import datetime
import os
from copy import deepcopy

from docx import Document
from docx.text.paragraph import Paragraph
from docx.table import Table
from docx.oxml import OxmlElement
from docx.shared import Inches


class DocxTool:
    def _create_spacer(self):
        return OxmlElement("w:p")

    def parse_docx_bytes(self, file_path: str):
        from docx.oxml.ns import qn

        doc = Document(file_path)
        content = []

        for block in doc.element.body:
            if block.tag == qn("w:p"):
                text = "".join(node.text for node in block.iter(qn("w:t")) if node.text)
                if text.strip():
                    content.append(text.strip())
            elif block.tag == qn("w:tbl"):
                for row in block.findall(".//" + qn("w:tr")):
                    cells = []
                    for cell in row.findall(".//" + qn("w:tc")):
                        cell_text = "".join(
                            n.text for n in cell.iter(qn("w:t")) if n.text
                        )
                        if cell_text.strip():
                            cells.append(cell_text.strip())
                    if cells:
                        content.append(" | ".join(cells))

        return "\n".join(content)

    def _remove_paragraph(self, paragraph):
        p = paragraph._element
        p.getparent().remove(p)
        p._p = p._element = None

    def _replace_in_paragraph(self, paragraph, mapping: dict):
        """
        Replace all placeholder keys with values in a single paragraph.

        Handles two cases:
        1. Placeholder is entirely within a single run  → simple run.text replace
        2. Placeholder is split across consecutive runs → merge run texts,
           replace, write result back into the FIRST run, clear the rest.
        """
        if not paragraph.text:
            return

        # --- Fast path: nothing to do ---
        para_text = paragraph.text
        if not any(key in para_text for key in mapping):
            return

        # --- Try single-run replacement first (preserves per-run formatting) ---
        for run in paragraph.runs:
            if not run.text:
                continue
            for key, value in mapping.items():
                if key in run.text:
                    run.text = run.text.replace(key, str(value) if value else "")

        # --- Re-check: if any key still present, the placeholder is split ---
        para_text = paragraph.text
        if not any(key in para_text for key in mapping):
            return

        # Build a merged view of all run texts and a map back to run objects.
        # We track (run_index, char_offset) for every character position.
        runs = paragraph.runs
        merged = ""
        positions = []  # (run_index, char_offset_in_run)
        for r_idx, run in enumerate(runs):
            t = run.text or ""
            for c_idx, _ in enumerate(t):
                positions.append((r_idx, c_idx))
            merged += t

        for key, value in mapping.items():
            if key not in merged:
                continue

            replacement = str(value) if value else ""
            start = merged.find(key)
            while start != -1:
                end = start + len(key)  # exclusive

                # Determine which runs are involved
                first_run_idx = positions[start][0]
                last_run_idx = positions[end - 1][0]

                # Rebuild text for the first run: everything before key start +
                # replacement + everything after key end that belongs to first run
                first_run = runs[first_run_idx]
                first_run_start_pos = next(
                    i for i, p in enumerate(positions) if p[0] == first_run_idx
                )
                prefix = merged[first_run_start_pos:start]

                # The suffix: chars after key end that still belong to first run
                # (uncommon but possible if only part of the first run is consumed)
                suffix_after_end = ""
                if end < len(positions):
                    # chars after key that are still in first_run_idx
                    for pos_idx in range(end, len(positions)):
                        if positions[pos_idx][0] == first_run_idx:
                            suffix_after_end += merged[pos_idx]
                        else:
                            break

                first_run.text = prefix + replacement + suffix_after_end

                # Clear all intermediate and last runs that were part of the key
                for r_idx in range(first_run_idx + 1, last_run_idx + 1):
                    runs[r_idx].text = ""

                # Rebuild merged/positions for subsequent iterations
                merged = "".join(r.text or "" for r in runs)
                positions = []
                for r_idx2, run2 in enumerate(runs):
                    t2 = run2.text or ""
                    for c_idx2 in range(len(t2)):
                        positions.append((r_idx2, c_idx2))

                start = merged.find(key)

    def _replace_everywhere(self, doc, mapping: dict):
        """Replace placeholders in all paragraphs and table cells."""
        for p in doc.paragraphs:
            self._replace_in_paragraph(p, mapping)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        self._replace_in_paragraph(p, mapping)

    def _insert_list_section(self, doc, heading: str, items: list, placeholder: str):
        """
        If items is empty: remove both the section heading paragraph and the
        placeholder paragraph entirely so the section doesn't appear in the output.

        If items is non-empty: remove only the placeholder paragraph, then inject
        bullet items immediately after the heading paragraph.
        """
        # Find and remove placeholder paragraph (always)
        for p in list(doc.paragraphs):
            if placeholder in p.text:
                self._remove_paragraph(p)
                break

        # Find heading paragraph
        heading_para = None
        for p in doc.paragraphs:
            if heading in p.text:
                heading_para = p
                break

        if not items:
            # Remove the heading too — nothing to show
            if heading_para is not None:
                self._remove_paragraph(heading_para)
            return

        # Insert bullet items right after the heading
        if heading_para is not None:
            parent = heading_para._element.getparent()
            index = parent.index(heading_para._element)
            for item in reversed(items):
                new_para = doc.add_paragraph(f"• {item}")
                new_para.paragraph_format.left_indent = Inches(0.5)
                new_para.paragraph_format.first_line_indent = Inches(-0.25)
                parent.insert(index + 1, new_para._element)

    def _process_experience_section(self, doc, experiences: list):
        """
        Finds the {{DESIGNATION}}...{{RESPONSIBILITIES_BLOCK}} template range,
        clones it for each experience entry, fills placeholders, injects bullets
        for responsibilities, then replaces the template range with filled blocks.
        """
        body = doc.element.body
        start_marker = "{{DESIGNATION}}"
        end_marker = "{{RESPONSIBILITIES_BLOCK}}"

        start_index = end_index = -1

        for i, element in enumerate(body):
            if element.tag.endswith("p"):
                p = Paragraph(element, doc)
                if start_marker in p.text and start_index == -1:
                    start_index = i
                if end_marker in p.text:
                    end_index = i
                    break

        if start_index == -1 or end_index == -1:
            print("⚠️  Experience block markers not found in template.")
            return

        template_elements = list(body)[start_index : end_index + 1]
        new_blocks = []

        for idx, exp in enumerate(experiences):
            mapping = {
                "{{DESIGNATION}}": exp["DESIGNATION"],
                "{{COMPANY_NAME}}": exp["COMPANY_NAME"],
                "{{DURATION}}": exp["DURATION"],
                "{{PROJECT_NAME}}": exp["PROJECT_NAME"],
                "{{CLIENT}}": exp["CLIENT"],
                "{{ROLE}}": exp["ROLE"],
                "{{ENVIRONMENT}}": exp["ENVIRONMENT"],
                "{{COMPANY_DESCRIPTION}}": exp["COMPANY_DESCRIPTION"],
                "{{PROJECT_DETAILS}}": exp["PROJECT_DETAILS"],
            }

            current_exp_blocks = []
            for elem in template_elements:
                new_elem = deepcopy(elem)
                if new_elem.tag.endswith("p"):
                    p = Paragraph(new_elem, doc)
                    self._replace_in_paragraph(p, mapping)
                elif new_elem.tag.endswith("tbl"):
                    t = Table(new_elem, doc)
                    for row in t.rows:
                        for cell in row.cells:
                            for p in cell.paragraphs:
                                self._replace_in_paragraph(p, mapping)
                current_exp_blocks.append(new_elem)

            final_blocks = []
            for elem in current_exp_blocks:
                if elem.tag.endswith("p"):
                    p_text = "".join(n.text for n in elem.iter() if n.text)
                    if "{{RESPONSIBILITIES_BLOCK}}" in p_text:
                        for r in exp["RESPONSIBILITIES_BLOCK"]:
                            new_p = doc.add_paragraph(f"• {r}")
                            new_p.paragraph_format.left_indent = Inches(0.5)
                            new_p.paragraph_format.first_line_indent = Inches(-0.25)
                            final_blocks.append(new_p._element)
                            body.remove(new_p._element)
                        continue
                final_blocks.append(elem)

            new_blocks.extend(final_blocks)

            if idx < len(experiences) - 1:
                new_blocks.append(self._create_spacer())

        for i in range(end_index, start_index - 1, -1):
            body.remove(list(body)[i])
        for elem in reversed(new_blocks):
            body.insert(start_index, elem)

    def _process_skills_table(self, doc, skills: list):
        """
        Finds the table row containing {{SKILL_CATEGORY}}, clones it per skill,
        removes the template row.
        """
        for table in doc.tables:
            for row in table.rows:
                if "{{SKILL_CATEGORY}}" in row.cells[0].text:
                    template_row = row
                    for skill in skills:
                        new_row = deepcopy(template_row._tr)
                        table._tbl.append(new_row)
                        last = table.rows[-1]
                        last.cells[0].paragraphs[0].runs[0].text = (
                            skill["SKILL_CATEGORY"]
                            if last.cells[0].paragraphs[0].runs
                            else ""
                        )
                        last.cells[0].text = skill["SKILL_CATEGORY"]
                        last.cells[1].text = skill["SKILL_VALUES"]
                    table._tbl.remove(template_row._tr)
                    return

    def _process_education_table(self, doc, education: list):
        """
        Finds the education table (header row contains 'Sl. No.'),
        clones template row per education entry.
        """
        for table in doc.tables:
            if len(table.rows) >= 2 and "Sl. No." in table.rows[0].cells[0].text:
                template_row = table.rows[1]
                for edu in education:
                    new_row = deepcopy(template_row._tr)
                    table._tbl.append(new_row)
                    last = table.rows[-1]
                    last.cells[0].text = str(edu["SL_NO"])
                    last.cells[1].text = edu["YEAR"]
                    last.cells[2].text = edu["INSTITUTE"]
                    last.cells[3].text = edu["STREAM"]
                    last.cells[4].text = edu["PERCENTAGE"]
                table._tbl.remove(template_row._tr)
                return

    def generate_resume(
        self,
        template_path: str,
        normalized_data: dict,
        employee_id: str,
        output_dir: str = "output",
    ) -> dict:
        """
        Build a .docx resume from the template and normalized_data dict.
        """
        try:
            if not os.path.exists(template_path):
                return {
                    "status": "error",
                    "message": f"Template not found: {template_path}",
                }

            doc = Document(template_path)

            # 1. Simple scalar replacements
            self._replace_everywhere(
                doc,
                {
                    "{{FULL_NAME}}": normalized_data["FULL_NAME"],
                    "{{SUMMARY}}": normalized_data["SUMMARY"],
                },
            )

            # 2. Experience blocks
            if normalized_data.get("EXPERIENCES"):
                self._process_experience_section(doc, normalized_data["EXPERIENCES"])

            # 3. Skills table
            if normalized_data.get("SKILLS"):
                self._process_skills_table(doc, normalized_data["SKILLS"])

            # 4. Education table
            if normalized_data.get("EDUCATION"):
                self._process_education_table(doc, normalized_data["EDUCATION"])

            # 5. List sections
            self._insert_list_section(
                doc,
                "Skills & Abilities/Achievements",
                normalized_data.get("ACHIEVEMENTS"),
                "{{SKILL_OR_ACHIEVEMENT}}",
            )
            self._insert_list_section(
                doc,
                "Certifications",
                normalized_data.get("CERTIFICATIONS"),
                "{{CERTIFICATION}}",
            )
            self._insert_list_section(
                doc,
                "Activities and Interests",
                normalized_data.get("INTERESTS"),
                "{{ACTIVITY}}",
            )

            # 6. Save
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.abspath(
                os.path.join(
                    output_dir,
                    f"{employee_id}_resume_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.docx",
                )
            )
            doc.save(output_path)

            return {"status": "success", "data": output_path}

        except Exception as e:
            return {"status": "error", "message": str(e)}
