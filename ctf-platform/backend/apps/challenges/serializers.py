from django.conf import settings
from rest_framework import serializers

from .models import Challenge


class ChallengeListSerializer(serializers.ModelSerializer):
    is_solved = serializers.SerializerMethodField()
    hints_count = serializers.SerializerMethodField()
    current_points = serializers.SerializerMethodField()
    solve_count = serializers.SerializerMethodField()
    is_dynamic = serializers.SerializerMethodField()
    first_blood_username = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            "slug", "name", "description",
            "points", "current_points", "min_points", "decay",
            "solve_count", "is_dynamic",
            "first_blood_username",
            "hints_count", "is_active", "is_solved",
        ]

    def get_is_solved(self, obj):
        return obj.slug in self.context.get("solved_slugs", set())

    def get_hints_count(self, obj):
        return len(obj.hints)

    def get_solve_count(self, obj):
        return self.context.get("solve_counts", {}).get(obj.slug, 0)

    def get_current_points(self, obj):
        solve_count = self.context.get("solve_counts", {}).get(obj.slug, 0)
        return obj.compute_points(solve_count)

    def get_is_dynamic(self, obj):
        return getattr(settings, "DYNAMIC_SCORING", False)

    def get_first_blood_username(self, obj):
        return self.context.get("first_bloods", {}).get(obj.slug)


class HintSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    cost = serializers.IntegerField()
    text = serializers.CharField(required=False, allow_null=True)
    unlocked = serializers.BooleanField()


class ChallengeDetailSerializer(serializers.ModelSerializer):
    is_solved = serializers.SerializerMethodField()
    hints_detail = serializers.SerializerMethodField()
    current_points = serializers.SerializerMethodField()
    solve_count = serializers.SerializerMethodField()
    is_dynamic = serializers.SerializerMethodField()
    first_blood_username = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            "slug", "name", "description",
            "points", "current_points", "min_points", "decay",
            "solve_count", "is_dynamic",
            "first_blood_username",
            "hints_detail", "is_active", "is_solved", "created_at",
        ]

    def get_is_solved(self, obj):
        return obj.slug in self.context.get("solved_slugs", set())

    def get_solve_count(self, obj):
        return self.context.get("solve_count", 0)

    def get_current_points(self, obj):
        solve_count = self.context.get("solve_count", 0)
        return obj.compute_points(solve_count)

    def get_is_dynamic(self, obj):
        return getattr(settings, "DYNAMIC_SCORING", False)

    def get_first_blood_username(self, obj):
        return self.context.get("first_blood_username")

    def get_hints_detail(self, obj):
        unlocked = self.context.get("unlocked_hint_indices", set())
        return [
            {
                "index": i,
                "cost": h.get("cost", 0),
                "text": h["text"] if i in unlocked else None,
                "unlocked": i in unlocked,
            }
            for i, h in enumerate(obj.hints)
        ]


class SubmitSerializer(serializers.Serializer):
    flag = serializers.CharField(max_length=256, trim_whitespace=False)
