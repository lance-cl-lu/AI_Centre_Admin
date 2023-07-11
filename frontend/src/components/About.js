import { Link } from "react-router-dom";

function About() {
    return (
        <div>
            <h1>About</h1><br/>
            <span>單位位置：長庚大學管理大樓11樓</span><br/>
            <span>中心網址：</span><Link to="https://aic.cgu.edu.tw" ><span>https://aic.cgu.edu.tw</span></Link><br/>
            <span>諮詢電話：+886-3-2118800 ext 3001</span><br/>
            <span>電子信箱：<Link to="mailto:sueliu@cgu.edu.tw">sueliu@cgu.edu.tw</Link></span>
        </div>
    );
}

export default About;