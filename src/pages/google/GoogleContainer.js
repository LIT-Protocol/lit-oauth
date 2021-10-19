import GoogleGranting from "./GoogleGranting";
import GoogleLink from "./GoogleLink";

function GoogleContainer() {

  if (window.location.pathname.includes("/l/")) {
    return (
      <div>
        <GoogleLink />
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
