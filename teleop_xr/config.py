from enum import Enum
from typing import List, Optional, Dict, Union, Any
from pydantic import BaseModel, Field


class InputMode(str, Enum):
    CONTROLLER = "controller"
    HAND = "hand"
    AUTO = "auto"


class ViewConfig(BaseModel):
    """One view the page shows as a panel.

    `device` is the capture device the view's frames are read from; None for
    a view fed by a video source the embedder supplies. A `raised` panel
    floats above the row of the others.
    """

    device: Optional[Union[int, str]] = None
    width: int = 1280
    height: int = 720
    fps: int = 30
    raised: bool = False


class RobotVisConfig(BaseModel):
    urdf_path: str
    mesh_path: Optional[str] = None
    model_scale: float = 1.0
    initial_rotation_euler: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])


class TeleopSettings(BaseModel):
    host: str = "0.0.0.0"
    port: int = 4443
    robot_vis: Optional[RobotVisConfig] = None
    input_mode: InputMode = InputMode.CONTROLLER
    speed: float = 1.0
    natural_phone_orientation_euler: List[float] = Field(
        default_factory=lambda: [0.0, -0.7853981633974483, 0.0]
    )
    natural_phone_position: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    camera_views: Dict[str, ViewConfig] = Field(default_factory=dict)
    video_config: Optional[Dict[str, Any]] = None
