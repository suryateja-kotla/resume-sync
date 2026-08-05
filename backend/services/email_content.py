"""
Email copy, composed per recipient group.

Three groups, because a single message cannot be right for all of them. The
old cycle sent everyone "Want to update your resume?" — including 33 people
who had never uploaded one and would land on a blank upload screen. The words
have to match what the person actually sees when they click.

    COMPLETE      resume + skill profile   -> review and refresh
    NO_RESUME     nothing at all           -> welcome, upload first
    NO_PROFILE    resume but no profile    -> finish the skill profile

Two occasions:

    launch    one-off announcement when the tool goes live. Leads with what
              SyncFolio is, because most recipients have never heard of it.
    monthly   the recurring reminder. Assumes they know the tool by now.

One layout (templates/email_base.html) with composed content, rather than six
near-identical HTML files that would drift apart the first time someone edits
one and forgets the others.
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path

_TEMPLATE = Path(__file__).parent.parent / "templates" / "email_base.html"


class Group(str, Enum):
    COMPLETE = "complete"
    NO_RESUME = "no_resume"
    NO_PROFILE = "no_profile"


def classify(has_resume: bool, has_skill_profile: bool) -> Group:
    if not has_resume:
        return Group.NO_RESUME
    if not has_skill_profile:
        return Group.NO_PROFILE
    return Group.COMPLETE


# Shown on launch only. Most people have never heard of the tool, so the first
# email has to explain it before asking for anything.
_ABOUT = """
        <div class="about">
          <h3>What is SyncFolio?</h3>
          <p style="margin:0;font-size:13.5px;color:#4c1d95;">
            One place where Sails keeps every employee's resume and current
            skills, so the right people can be found for the right projects.
          </p>
          <ul>
            <li>Your resume is parsed automatically &mdash; no forms to fill in by hand</li>
            <li>Your skill profile shows what you work on <em>now</em>, which
                a resume alone does not capture</li>
            <li>Delivery leads search it when staffing projects</li>
          </ul>
        </div>
"""


def _buttons(update_url: str, decline_url: str | None) -> str:
    """Primary action, plus an optional "nothing changed" acknowledgement.

    The decline button exists so silence stops being ambiguous. Without it HR
    cannot tell someone who checked and had no changes from someone who never
    opened the email — and the first group should not be chased.
    """
    primary = f'<a href="{update_url}" class="button btn-yes">Open SyncFolio</a>'
    if not decline_url:
        return primary
    return (
        primary
        + f'<a href="{decline_url}" class="button btn-no">Nothing has changed</a>'
    )


def build(
    *,
    group: Group,
    name: str,
    update_url: str,
    decline_url: str | None = None,
    launch: bool = False,
) -> tuple[str, str]:
    """Returns (subject, html) for one recipient."""

    if launch:
        subject, heading, subheading, body = _launch_copy(group)
    else:
        subject, heading, subheading, body = _monthly_copy(group)

    html = _TEMPLATE.read_text(encoding="utf-8").format(
        heading=heading,
        subheading=subheading,
        name=name,
        body_html=body,
        buttons_html=_buttons(update_url, decline_url),
        update_url=update_url,
    )
    return subject, html


# ── Launch copy ──────────────────────────────────────────────────────────────


def _launch_copy(group: Group) -> tuple[str, str, str, str]:
    if group is Group.NO_RESUME:
        return (
            "Welcome to SyncFolio — please upload your resume",
            "Welcome to SyncFolio",
            "Sails Software · Skill &amp; Resume Inventory",
            _ABOUT + """
        <p>
          We could not find a resume for you yet, so there is nothing in your
          profile at the moment.
        </p>
        <ol class="steps">
          <li><strong>Upload your resume</strong> &mdash; it is read
              automatically, so you do not have to retype anything.</li>
          <li><strong>Set your skill profile</strong> &mdash; your current
              skill, how long you have worked with it, and your total
              experience.</li>
        </ol>
        <p>It takes a couple of minutes, and you sign in with your usual
           Sails Microsoft account &mdash; no new password.</p>
""",
        )

    if group is Group.NO_PROFILE:
        return (
            "SyncFolio is live — please complete your skill profile",
            "SyncFolio is now live",
            "Sails Software · Skill &amp; Resume Inventory",
            _ABOUT + """
        <p>
          Your resume is already in SyncFolio &mdash; thank you. One piece is
          still missing: your <strong>skill profile</strong>.
        </p>
        <p>
          Until that is filled in you will not appear in skill searches, so
          delivery leads staffing a project will not see you.
        </p>
        <ol class="steps">
          <li>Open SyncFolio and check your resume looks right</li>
          <li>Fill in your <strong>skill profile</strong> &mdash; current
              skill, years in it, and total experience</li>
        </ol>
""",
        )

    return (
        "SyncFolio is live — please check your details are accurate",
        "SyncFolio is now live",
        "Sails Software · Skill &amp; Resume Inventory",
        _ABOUT + """
        <p>
          We have pre-loaded your resume and skill details from our existing
          records. <strong>Please check they are accurate</strong> &mdash;
          some of it may be out of date.
        </p>
        <ol class="steps">
          <li>Review your <strong>resume</strong> and update anything that has
              changed</li>
          <li>Confirm your <strong>skill profile</strong> reflects what you
              are working on now, not what you joined doing</li>
        </ol>
        <p>You sign in with your usual Sails Microsoft account &mdash; no new
           password needed.</p>
""",
    )


# ── Monthly copy ─────────────────────────────────────────────────────────────


def _monthly_copy(group: Group) -> tuple[str, str, str, str]:
    if group is Group.NO_RESUME:
        return (
            "Your SyncFolio profile is still empty",
            "Your profile is empty",
            "Monthly reminder",
            """
        <p>
          You do not have a resume in SyncFolio yet, which means you will not
          show up when delivery leads search for skills.
        </p>
        <ol class="steps">
          <li><strong>Upload your resume</strong> &mdash; it is read
              automatically</li>
          <li><strong>Set your skill profile</strong> &mdash; current skill and
              experience</li>
        </ol>
""",
        )

    if group is Group.NO_PROFILE:
        return (
            "One step left — complete your SyncFolio skill profile",
            "One step left",
            "Monthly reminder",
            """
        <p>
          Your resume is in SyncFolio, but your <strong>skill profile</strong>
          is still blank &mdash; so you do not appear in skill searches.
        </p>
        <p>
          It is four fields: your current skill, how long you have worked with
          it, your primary skill and your total experience.
        </p>
""",
        )

    return (
        "Time to refresh your SyncFolio profile",
        "Keep your profile current",
        "Monthly reminder",
        """
        <p>
          A quick monthly check &mdash; has anything changed since last month?
        </p>
        <ol class="steps">
          <li><strong>Your resume</strong> &mdash; new projects, certifications
              or achievements worth adding?</li>
          <li><strong>Your skill profile</strong> &mdash; still accurate? If
              you have moved onto a different technology, update your current
              skill so you are found for the right work.</li>
        </ol>
        <p style="font-size:13.5px;color:#64748b;">
          If nothing has changed, use the second button below and we will not
          chase you again this month.
        </p>
""",
    )
