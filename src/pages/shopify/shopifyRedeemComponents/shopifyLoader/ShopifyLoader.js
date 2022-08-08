import './ShopifyLoader.css';

const ShopifyLoader = ({loaderMessage}) => {
  return (
    <span>
      <div className="lit-loader">
        <div></div>
        <div></div>
      </div>
      <p className="lit-loader-text">{loaderMessage}</p>
    </span>
  )
}

export default ShopifyLoader;