import asyncio
import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

import teleop_xr
from teleop_xr.config import TeleopSettings, ViewConfig


class Source:
    def start(self) -> None:
        pass

    def stop(self) -> None:
        pass

    def read(self):
        return False, None


def test_config_route_serves_the_settings_the_socket_sends_at_connect():
    settings = TeleopSettings(
        camera_views={"status": ViewConfig(raised=True), "head": ViewConfig(device=0)}
    )
    teleop = teleop_xr.Teleop(settings, video_sources={"status": Source()})
    client = TestClient(teleop.app)

    served = client.get("/config").json()
    with client.websocket_connect("/ws") as ws:
        sent = ws.receive_json()
    assert sent["type"] == "config"
    assert served == sent["data"]
    assert served["camera_views"] == {
        "status": {
            "device": None,
            "width": 1280,
            "height": 720,
            "fps": 30,
            "raised": True,
        },
        "head": {"device": 0, "width": 1280, "height": 720, "fps": 30, "raised": False},
    }


@pytest.mark.anyio
async def test_replaced_sources_reach_every_page_in_session_and_the_next_to_connect(
    monkeypatch: pytest.MonkeyPatch,
):
    offered: list[dict[str, Any]] = []

    class RecordingManager:
        def __init__(self, sources: dict[str, Any]):
            offered.append(dict(sources))
            self.closed = False

        async def create_offer(self):
            return SimpleNamespace(sdp="", type="offer")

        async def close(self) -> None:
            self.closed = True

    monkeypatch.setattr(teleop_xr, "VideoStreamManager", RecordingManager)
    teleop: Any = teleop_xr.Teleop(
        TeleopSettings(camera_views={"status": ViewConfig(raised=True)}),
        video_sources={"status": Source()},
    )
    told: list[dict[str, Any]] = []

    async def broadcast(text: str) -> None:
        told.append(json.loads(text))

    page = object()
    teleop._Teleop__manager.broadcast = broadcast
    teleop._Teleop__manager.send_personal_message = _drop
    old = RecordingManager({})
    teleop._Teleop__video_sessions[page] = old

    chest = Source()
    views = {"status": ViewConfig(raised=True), "chest": ViewConfig()}
    await teleop.replace_video_sources({"status": Source(), "chest": chest}, views)

    assert [message["type"] for message in told] == ["config"]
    assert list(told[0]["data"]["camera_views"]) == ["status", "chest"]
    assert told[0]["data"]["camera_views"]["chest"]["raised"] is False
    # The page in session restarted on the new sources, its old session closed ...
    assert old.closed
    assert list(offered[-1]) == ["status", "chest"]
    assert offered[-1]["chest"] is chest
    # ... and the next page to connect is offered the same.
    await teleop._start_video_session(object())
    assert list(offered[-1]) == ["status", "chest"]


@pytest.mark.anyio
async def test_a_page_whose_video_fails_to_restart_loses_its_session_alone(
    monkeypatch: pytest.MonkeyPatch,
):
    class Manager:
        def __init__(self, _sources: dict[str, Any]):
            self.closed = False

        async def create_offer(self):
            return SimpleNamespace(sdp="", type="offer")

        async def close(self) -> None:
            self.closed = True

    monkeypatch.setattr(teleop_xr, "VideoStreamManager", Manager)
    teleop: Any = teleop_xr.Teleop(TeleopSettings())
    teleop._Teleop__manager.broadcast = _drop
    dead, live = object(), object()

    async def send_personal_message(_text: str, websocket: Any) -> None:
        if websocket is dead:
            raise ConnectionError("socket gone")

    teleop._Teleop__manager.send_personal_message = send_personal_message
    before = {dead: Manager({}), live: Manager({})}
    teleop._Teleop__video_sessions.update(before)

    await teleop.replace_video_sources({"chest": Source()}, {"chest": ViewConfig()})

    sessions = teleop._Teleop__video_sessions
    assert dead not in sessions
    assert live in sessions and sessions[live] is not before[live]
    assert before[dead].closed and before[live].closed


@pytest.mark.anyio
async def test_video_sessions_start_one_at_a_time(monkeypatch: pytest.MonkeyPatch):
    running = 0
    overlapped = False

    class SlowManager:
        def __init__(self, _sources: dict[str, Any]):
            pass

        async def create_offer(self):
            nonlocal running, overlapped
            running += 1
            overlapped = overlapped or running > 1
            await asyncio.sleep(0.01)
            running -= 1
            return SimpleNamespace(sdp="", type="offer")

        async def close(self) -> None:
            pass

    monkeypatch.setattr(teleop_xr, "VideoStreamManager", SlowManager)
    teleop: Any = teleop_xr.Teleop(TeleopSettings())
    teleop._Teleop__manager.send_personal_message = _drop
    page = object()

    await asyncio.gather(
        teleop._start_video_session(page), teleop._start_video_session(page)
    )

    assert not overlapped


@pytest.mark.anyio
async def test_replacements_run_one_at_a_time(monkeypatch: pytest.MonkeyPatch):
    events: list[str] = []

    class SlowManager:
        def __init__(self, sources: dict[str, Any]):
            self.keys = ",".join(sources)

        async def create_offer(self):
            await asyncio.sleep(0.01)
            events.append(f"offer:{self.keys}")
            return SimpleNamespace(sdp="", type="offer")

        async def close(self) -> None:
            pass

    monkeypatch.setattr(teleop_xr, "VideoStreamManager", SlowManager)
    teleop: Any = teleop_xr.Teleop(TeleopSettings())

    async def broadcast(text: str) -> None:
        events.append("config:" + ",".join(json.loads(text)["data"]["camera_views"]))

    teleop._Teleop__manager.broadcast = broadcast
    teleop._Teleop__manager.send_personal_message = _drop
    teleop._Teleop__video_sessions[object()] = SlowManager({})

    await asyncio.gather(
        teleop.replace_video_sources({"a": Source()}, {"a": ViewConfig()}),
        teleop.replace_video_sources({"b": Source()}, {"b": ViewConfig()}),
    )

    # Every page restarted on one replacement before the next was told.
    assert events == ["config:a", "offer:a", "config:b", "offer:b"]


async def _drop(*_args: Any) -> None:
    pass
