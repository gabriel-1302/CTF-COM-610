import glob
import os

import markdown
from django.contrib import admin
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.urls import path
from django.utils.safestring import mark_safe

from .models import Challenge, Solve

SOLUCIONES_DIR = os.path.join(
    os.path.dirname(__file__),  # apps/challenges/
    "..", "..", "..", "soluciones",  # ctf-platform/soluciones/
)


def _find_solucionario(slug: str) -> str | None:
    pattern = os.path.join(SOLUCIONES_DIR, f"*_{slug}.md")
    matches = glob.glob(pattern)
    if not matches:
        return None
    with open(matches[0], encoding="utf-8") as f:
        return f.read()


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ["slug", "name", "points", "image_name", "internal_port", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["slug", "name"]
    readonly_fields = ["flag_hash", "created_at"]
    ordering = ["points"]
    change_form_template = "admin/challenges/challenge/change_form.html"

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "<int:pk>/solucionario/",
                self.admin_site.admin_view(self.solucionario_view),
                name="challenges_challenge_solucionario",
            ),
        ]
        return custom + urls

    def solucionario_view(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk)
        raw = _find_solucionario(challenge.slug)
        html_content = None
        if raw:
            html_content = mark_safe(
                markdown.markdown(raw, extensions=["fenced_code", "tables", "toc"])
            )
        context = {
            **self.admin_site.each_context(request),
            "challenge": challenge,
            "html_content": html_content,
            "title": f"Solucionario — {challenge.name}",
        }
        return TemplateResponse(
            request,
            "admin/challenges/challenge/solucionario.html",
            context,
        )


@admin.register(Solve)
class SolveAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "challenge", "solved_at"]
    list_filter = ["challenge"]
    search_fields = ["user__username", "challenge__slug"]
    readonly_fields = ["solved_at"]
    ordering = ["-solved_at"]
