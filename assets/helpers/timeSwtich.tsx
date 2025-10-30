export const timeSwitch = (time: string | number) => {
    if (typeof time === 'number') {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60 < 10 ? `0${time % 60}` : time % 60;
      return `${minutes}:${seconds}`;
    } else {
      const [minutes, seconds] = time.split(':').map(Number);
      return minutes * 60 + seconds;
    }
  }