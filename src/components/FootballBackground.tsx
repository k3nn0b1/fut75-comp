import footballSvg from "@/assets/football.svg";
import footballSvg2 from "@/assets/football2.svg";

const FootballBackground = () => {
  const footballImages = [footballSvg, footballSvg2];
  
  return (
    <div className="football-bg">
      {[...Array(8)].map((_, i) => (
        <img
          key={i}
          src={footballImages[i % 2]}
          alt=""
          className="football"
        />
      ))}
    </div>
  );
};

export default FootballBackground;
