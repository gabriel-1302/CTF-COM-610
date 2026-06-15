import json

from channels.generic.websocket import AsyncWebsocketConsumer


class ScoreboardConsumer(AsyncWebsocketConsumer):
    GROUP = "scoreboard"

    async def connect(self):
        await self.channel_layer.group_add(self.GROUP, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.GROUP, self.channel_name)

    async def scoreboard_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "scoreboard_update",
            "entries": event["entries"],
            "frozen": event.get("frozen", False),
            "freeze_time": event.get("freeze_time"),
        }))

    async def first_blood(self, event):
        await self.send(text_data=json.dumps({
            "type": "first_blood",
            "challenge_slug": event["challenge_slug"],
            "challenge_name": event["challenge_name"],
            "username": event["username"],
            "team_name": event.get("team_name"),
            "points_earned": event["points_earned"],
        }))
