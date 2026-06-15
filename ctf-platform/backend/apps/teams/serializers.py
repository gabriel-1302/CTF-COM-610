from rest_framework import serializers

from .models import Team, TeamMembership


class TeamMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id")
    username = serializers.CharField(source="user.username")
    score = serializers.IntegerField(source="user.score")
    solved_count = serializers.IntegerField(source="user.solved_count")
    is_captain = serializers.SerializerMethodField()

    class Meta:
        model = TeamMembership
        fields = ["user_id", "username", "score", "solved_count", "is_captain", "joined_at"]

    def get_is_captain(self, obj):
        return obj.user_id == obj.team.captain_id


class TeamSerializer(serializers.ModelSerializer):
    members = TeamMemberSerializer(source="memberships", many=True, read_only=True)
    captain_username = serializers.CharField(source="captain.username", read_only=True, default=None)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id", "name", "join_code", "captain_username",
            "score", "solved_count", "member_count",
            "is_banned", "is_hidden", "members", "created_at",
        ]
        read_only_fields = [
            "id", "join_code", "score", "solved_count",
            "is_banned", "is_hidden", "created_at",
        ]

    def get_member_count(self, obj):
        return obj.memberships.count()


class TeamScoreboardSerializer(serializers.ModelSerializer):
    captain_username = serializers.CharField(source="captain.username", read_only=True, default=None)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ["id", "name", "score", "solved_count", "member_count", "captain_username"]

    def get_member_count(self, obj):
        return obj.memberships.count()


class CreateTeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, min_length=3)

    def validate_name(self, value):
        if Team.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un equipo con ese nombre.")
        return value


class JoinTeamSerializer(serializers.Serializer):
    join_code = serializers.CharField(max_length=8, min_length=8)
