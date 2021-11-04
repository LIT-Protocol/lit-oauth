import GoogleGranting from "./GoogleGranting";
import GoogleLinkShare from "./GoogleLinkShare";

function GoogleContainer() {

  if (window.location.pathname.includes("/l/")) {
    return (
      <div>
        <GoogleLinkShare />
      </div>
    );
  }

  return (
    <div>
      <GoogleGranting />
    </div>
  );
}

export default GoogleContainer;
