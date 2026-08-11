from pydantic import BaseModel


class ClothingAnalysisRequest(BaseModel):
    image_url: str