import React from "react";
import { Composition } from "remotion";
import { StoryForkDemo } from "./StoryForkDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StoryForkDemo"
        component={StoryForkDemo}
        durationInFrames={5160}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
