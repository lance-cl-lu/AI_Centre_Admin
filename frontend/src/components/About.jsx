import { Link } from "react-router-dom";

function About() {
    return (
        <div>
            <h1>About</h1><br/>
            <span>單位位置：長庚大學管理大樓11樓</span><br/>
            <div><iframe width="100%" height="600" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?width=100%25&amp;height=600&amp;hl=en&amp;q=333%E6%A1%83%E5%9C%92%E5%B8%82%E9%BE%9C%E5%B1%B1%E5%8D%80%E6%96%87%E5%8C%96%E4%B8%80%E8%B7%AF259%E8%99%9F+(%E9%95%B7%E5%BA%9A%E5%A4%A7%E5%AD%B8AI%E4%B8%AD%E5%BF%83)&amp;t=&amp;z=17&amp;ie=UTF8&amp;iwloc=B&amp;output=embed"><a href="https://www.maps.ie/population/">Calculate population in area</a></iframe></div><br/>
            <span>中心網址：</span><Link to="https://aic.cgu.edu.tw" ><span>https://aic.cgu.edu.tw</span></Link><br/>
            <span>諮詢電話：+886-3-2118800 ext 3001</span><br/>
            <span>電子信箱：<Link to="mailto:sueliu@cgu.edu.tw">sueliu@cgu.edu.tw</Link></span>
        </div>
    );
}

export default About;