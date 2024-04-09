import * as Yup from 'yup';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import React, { Fragment, useRef, useState, useEffect } from 'react';

import TextareaAutosize from 'react-textarea-autosize';
import kebabCase from 'lodash/kebabCase';
import logo from './Final-cut.png';
import { useLocalStorage } from './hooks';
import { useReactToPrint } from 'react-to-print';
import { db } from './firestore';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

const formatter = Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
});

const ExpandingText = ({ field, form, ...props }) => {
  return <TextareaAutosize {...field} {...props} className="textarea" />;
};

const tax = {
  _: { gst: 0, pst: 0, hst: 0 },
  NONE: { gst: 0, pst: 0, hst: 0 },
  AB: { gst: 0.05, pst: 0, hst: 0 },
  BC: { gst: 0.05, pst: 0.07, hst: 0 },
  MB: { gst: 0.05, pst: 0.07, hst: 0 },
  NB: { gst: 0, pst: 0, hst: 0.15 },
  NL: { gst: 0, pst: 0, hst: 0.15 },
  NT: { gst: 0.05, pst: 0, hst: 0 },
  NS: { gst: 0, pst: 0, hst: 0.15 },
  NU: { gst: 0.05, pst: 0, hst: 0 },
  ON: { gst: 0, pst: 0, hst: 0.13 },
  PE: { gst: 0, pst: 0, hst: 0.15 },
  QC: { gst: 0.05, pst: 0.09975, hst: 0 },
  SK: { gst: 0.05, pst: 0.06, hst: 0 },
  YT: { gst: 0.05, pst: 0, hst: 0 },
};

const Quote = () => {
  const tableRef = useRef();
  const [showPst, setShowPst] = useState(null);
  const [pst, setPst] = useState(0);
  const [gst, setGst] = useState(0);
  const [taxValue, setTaxValue] = useState(0);
  const [total, setTotal] = useState(null);
  const [address, saveAddress] = useLocalStorage(
    'address',
    'Pentagon Millwork Ltd. \n24 Woodfern drive SW \n T2W4E4 \n (403) 555-6677 \n pentagonmillwork@yahoo.ca'
  );
  const [addr, setAddr] = useState(address);
  const [quote, saveQuote] = useLocalStorage('Quote', '077260');
  const [quoteNo, setQuoteNo] = useState(`0${parseInt(quote) + 1}`);
  const [client, saveClient] = useLocalStorage('client', '');
  const [docId, setDocId] = useState('Quote');

  const saveQuoteEverywhere = async (QuoteNo) => {
    console.log('quoteNo', quoteNo);
    await saveQuotetoDB(quoteNo);
    await saveQuote(quoteNo);
    await setQuoteNo(`0${parseInt(quoteNo) + 1}`);
  };

  const saveQuotetoDB = async (QuoteNo) => {
    try {
      await setDoc(doc(db, 'quote', docId), { quoteNo });
    } catch (error) {
      console.error('Error adding document: ', error);
      await saveQuote(QuoteNo);
    }
  };
  const getQuoteFromDB = async () => {
    try {
      await getDocs(collection(db, 'quote')).then((querySnapshot) => {
        const newData = querySnapshot.docs.reduce((acc, doc) => {
          return (acc = { id: doc.id, ...doc.data() });
        }, {});
        if (newData.quoteNo) {
          setQuoteNo(`0${parseInt(newData.quoteNo) + 1}`);
          setDocId(newData.id);
        }
      });
    } catch (error) {
      console.error('Error getting documents: ', error);
    }
  };
  useEffect(() => {
    getQuoteFromDB();
  }, []);

  const printClient = client.split('\n')?.[0] || 'client-name';
  const handlePrint = useReactToPrint({
    documentTitle: `${quoteNo}-${kebabCase(
      printClient
    )}-${new Date().getFullYear()}`,
    content: () => tableRef.current,
  });

  const sumItUp = (values) => {
    const sum = values.items.reduce((acc, item) => {
      if (item.amount) {
        return acc + item.amount;
      } else return acc;
    }, 0);
    setTotal(sum);
  };

  const taxItUp = (values, taxable, index) => {
    const realValues = values.items.map((item, i) => {
      if (i === index && taxable !== undefined) {
        return { ...item, taxable };
      } else return item;
    });

    const pst = tax[values.province]?.pst || tax[values.province]?.hst;
    const gst = tax[values.province]?.gst;
    let myTax = [];
    let myGst = [];
    let myPst = [];

    realValues?.forEach((item, i) => {
      console.log('item', item);
      if (item.taxable) {
        if (gst) {
          myTax.push(item.amount * gst);
          myGst.push(item.amount * gst);
        }
        if (pst) {
          myTax.push(item.amount * pst);
          myPst.push(item.amount * pst);
        }
      } else {
        myTax.slice(i, 1);
        myGst.slice(i, 1);
        myPst.slice(i, 1);
      }
    });

    const numTax = myTax.reduce((a, b) => a + b, 0);
    const numGst = myGst.reduce((a, b) => a + b, 0);
    const numPst = myPst.reduce((a, b) => a + b, 0);

    setTaxValue(numTax);
    setGst(numGst);
    setPst(numPst);
  };

  const validationSchema = Yup.object({
    soldTo: Yup.string().required('required'),
    date: Yup.date().required('required'),
    validUntil: Yup.date().required('required'),
    province: Yup.string().required('required'),
    items: Yup.array().of(
      Yup.object().shape({
        desc: Yup.string().required('required').min(3, 'Too Short!'),
        taxable: Yup.bool().required('required'),
        amount: Yup.number()
          .moreThan(0, 'invalid')
          .required('required')
          .typeError('invalid'),
      })
    ),
  });

  return (
    <div ref={tableRef}>
      <header>
        <div>
          <img height="200" src={logo} alt="Pentagon Millwork Ltd." />
        </div>
        <div className="address">
          <h1>Quote</h1>
          <TextareaAutosize
            onChange={(e) => {
              setAddr(e.target.value);
            }}
            onBlur={(e) => {
              saveAddress(e.target.value);
            }}
            value={addr}
          ></TextareaAutosize>
        </div>
        <div>
          <input
            className="quote-no"
            value={quoteNo}
            onChange={(e) => {
              setQuoteNo(e.target.value);
            }}
          />
        </div>
      </header>
      <Formik
        initialValues={{
          soldTo: client,
          date: '',
          validUntil: '',
          customerId: '',
          province: '',
          phone: '587-839-8849',
          items: [
            {
              desc: '',
              taxable: false,
              amount: '',
            },
          ],
        }}
        onSubmit={() => {
          saveQuoteEverywhere(quoteNo);
          handlePrint();
        }}
        validationSchema={validationSchema}
      >
        {({ values, errors, handleChange, handleBlur, isValid }) => {
          // console.log("--------", errors);
          return (
            <Form>
              <div className="sale">
                <div className="row fullwidth">
                  <label htmlFor="soldTo" className="col1">
                    <span>Client info:</span>
                    <Field
                      name="soldTo"
                      id="soldTo"
                      component={ExpandingText}
                      className="client"
                      onBlur={(e) => {
                        handleBlur(e);
                        saveClient(e.target.value);
                      }}
                    />
                    <ErrorMessage
                      name="soldTo"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                </div>
                <div className="row">
                  <label htmlFor="soldTo" className="col1">
                    <span>Date:</span>
                    <Field name="date" type="date" />
                    <ErrorMessage
                      name="date"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                  <label htmlFor="customerId" className="col2">
                    <span>Customer ID:</span>
                    <Field name="customerId" component={ExpandingText} />
                    <ErrorMessage
                      name="customerId"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                </div>
                <div className="row">
                  <label htmlFor="validUntil" className="col1">
                    <span>Valid until:</span>
                    <Field name="validUntil" type="date" />
                    <ErrorMessage
                      name="validUntil"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                  <label htmlFor="province" className="col2 noprint">
                    <span>
                      Province: <br />
                      <small>(to calculate tax)</small>
                    </span>
                    <Field
                      name="province"
                      as="select"
                      className="province"
                      onChange={(e) => {
                        handleChange(e);
                        if (
                          tax[e.target.value].pst === 0 &&
                          tax[e.target.value].hst === 0
                        ) {
                          setShowPst(false);
                          setPst(0);
                        } else {
                          setShowPst(true);
                        }
                        sumItUp({ ...values, province: e.target.value });
                        taxItUp(
                          { ...values, province: e.target.value },
                          false,
                          -1
                        );
                      }}
                    >
                      <option value="_">Select a province</option>
                      {[
                        'NONE',
                        'AB',
                        'BC',
                        'MB',
                        'NB',
                        'NL',
                        'NS',
                        'NT',
                        'NU',
                        'ON',
                        'PE',
                        'QC',
                        'SK',
                        'YT',
                      ].map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </Field>
                    <ErrorMessage
                      name="province"
                      render={(msg) => <div className="error">{msg}</div>}
                    />
                  </label>
                </div>
              </div>
              <div className="row head">
                <div className="item">Item</div>
                <div className="desc">Description</div>
                <div className="unit">Taxable</div>
                <div className="amount">Amount</div>
                <div className="buttons noprint">Actions</div>
              </div>

              <FieldArray
                name="items"
                render={(arrayHelpers) => (
                  <Fragment>
                    {values.items && values.items.length > 0 ? (
                      values.items.map((item, index) => {
                        // console.log("item", item, "index", index);
                        return (
                          <div key={index} className="row">
                            <div className="item">
                              <span>{index + 1}</span>
                            </div>
                            <div className="desc">
                              <Field
                                component={ExpandingText}
                                name={`items.${index}.desc`}
                              />
                              <ErrorMessage
                                name={`items.${index}.desc`}
                                render={(msg) => (
                                  <div className="error">{msg}</div>
                                )}
                              />
                            </div>
                            <div className="taxable">
                              <Field name={`items.${index}.taxable`}>
                                {({
                                  field /* { name, value, onChange, onBlur } */,
                                }) => (
                                  <input
                                    {...field}
                                    onChange={(e) => {
                                      handleChange(e);
                                      taxItUp(values, e.target.checked, index);
                                    }}
                                    type="checkbox"
                                  />
                                )}
                              </Field>
                            </div>
                            <div className="amount">
                              <Field name={`items.${index}.amount`}>
                                {({
                                  field /* { name, value, onChange, onBlur } */,
                                }) => (
                                  <input
                                    {...field}
                                    onBlur={(e) => {
                                      handleBlur(e);
                                      sumItUp(values);
                                      taxItUp(values, undefined, index);
                                    }}
                                    type="number"
                                  />
                                )}
                              </Field>
                            </div>
                            <div className="buttons noprint">
                              <button
                                type="button"
                                onClick={() => {
                                  arrayHelpers.remove(index);
                                  const items = values.items.splice(index, 1);
                                  sumItUp({ ...values, items });
                                }} // remove a friend from the list
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => arrayHelpers.push({})} // insert an empty string at a position
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="center">
                        <button
                          className="add-item"
                          type="button"
                          onClick={() => arrayHelpers.push({})}
                        >
                          {/* show this when user has removed all friends from the list */}
                          Add a new item
                        </button>
                      </div>
                    )}
                    <div className={`row footer smaller border`}>
                      <div className="item"></div>
                      <div className="desc"></div>
                      <div className="unit">
                        <strong>GST:</strong>
                      </div>
                      <div className="amount">
                        <strong>
                          {`${formatter.format(
                            parseFloat(gst || 0).toFixed(2)
                          )}`}
                        </strong>
                      </div>
                    </div>
                    {showPst && (
                      <div className="row footer smaller">
                        <div className="item"></div>
                        <div className="desc"></div>
                        <div className="unit">
                          <strong>PST/HST:</strong>
                        </div>
                        <div className="amount">
                          <strong>
                            {`${formatter.format(
                              parseFloat(pst || 0).toFixed(2)
                            )}`}
                          </strong>
                        </div>
                      </div>
                    )}
                    <div className={`row footer smaller`}>
                      <div className="item"></div>
                      <div className="desc"></div>
                      <div className="unit">
                        <strong>Tax total:</strong>
                      </div>
                      <div className="amount">
                        <strong>
                          {`${formatter.format(
                            parseFloat(taxValue).toFixed(2)
                          )}`}
                        </strong>
                      </div>
                    </div>
                    <div className="row footer smaller border">
                      <div className="item"></div>
                      <div className="desc"></div>
                      <div className="unit">
                        <strong>Subtotal:</strong>
                      </div>
                      <div className="amount">
                        <strong>
                          {`${formatter.format(
                            parseFloat(total || 0).toFixed(2)
                          )}`}
                        </strong>
                      </div>
                    </div>
                    <div className="row footer border">
                      <div className="item"></div>
                      <div className="desc"></div>
                      <div className="unit">
                        <strong>Total due:</strong>
                      </div>
                      <div className="amount">
                        <strong>
                          {total
                            ? `${formatter.format(
                                parseFloat(
                                  total + (gst || 0) + (pst || 0)
                                ).toFixed(2)
                              )}`
                            : ''}
                        </strong>
                      </div>
                    </div>
                    <div className="small-print first">
                      Any on site modification, alteration of the millwork, any
                      additional extra work will be charged at the rate of
                      $70.00 per hour per worker.
                    </div>
                    <div className="small-print">
                      <h3>Terms and Conditions:</h3>
                      <ol>
                        <li>
                          Customer will be billed after indicating acceptance of
                          this quote.
                        </li>
                        <li>Payment terms: net 30 days after invoice date.</li>
                        <li>
                          Please fax, mail or email the signed price quote to
                          the address above.
                        </li>
                      </ol>
                      <h3>Customer Acceptance (sign below):</h3>
                      <div className="signature"></div>
                    </div>
                    <div className="center questions">
                      <p>
                        If you have any questions about this price quote, please
                        contact
                        <br />
                        Gary Fazekas
                        <Field className="phone" name="phone" />
                      </p>
                      <h4>Thank You For Your Business!</h4>
                    </div>
                    <div className="noprint cta">
                      <button
                        disabled={!isValid}
                        type="submit"
                        className={isValid ? 'valid' : 'invalid'}
                      >
                        Print Quote
                      </button>
                    </div>
                  </Fragment>
                )}
              />
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};
export default Quote;
