import { describe, it, expect } from 'vitest';
import { parsePubMedXml } from '../parser';

function wrapInSet(articles: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PubmedArticleSet>
${articles}
</PubmedArticleSet>`;
}

const SINGLE_ARTICLE_XML = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>12345678</PMID>
    <Article PubModel="Print-Electronic">
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <Volume>42</Volume>
          <Issue>3</Issue>
          <PubDate>
            <Year>2023</Year>
            <Month>Mar</Month>
            <Day>15</Day>
          </PubDate>
        </JournalIssue>
        <Title>Journal of Allergy and Clinical Immunology</Title>
        <ISOAbbreviation>J Allergy Clin Immunol</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Mechanisms of allergic sensitization in children</ArticleTitle>
      <Pagination>
        <MedlinePgn>100-112</MedlinePgn>
      </Pagination>
      <Abstract>
        <AbstractText>This study examines the mechanisms of allergic sensitization.</AbstractText>
      </Abstract>
      <AuthorList CompleteYN="Y">
        <Author ValidYN="Y">
          <LastName>Smith</LastName>
          <ForeName>John A</ForeName>
          <Initials>JA</Initials>
          <AffiliationInfo>
            <Affiliation>Department of Allergy, University Hospital, Boston, MA</Affiliation>
          </AffiliationInfo>
        </Author>
        <Author ValidYN="Y">
          <LastName>Doe</LastName>
          <ForeName>Jane</ForeName>
          <Initials>J</Initials>
        </Author>
      </AuthorList>
    </Article>
    <KeywordList Owner="NOTNLM">
      <Keyword MajorTopicYN="N">allergy</Keyword>
      <Keyword MajorTopicYN="N">sensitization</Keyword>
      <Keyword MajorTopicYN="N">children</Keyword>
    </KeywordList>
    <MeshHeadingList>
      <MeshHeading>
        <DescriptorName UI="D006967" MajorTopicYN="Y">Hypersensitivity</DescriptorName>
      </MeshHeading>
      <MeshHeading>
        <DescriptorName UI="D002648" MajorTopicYN="N">Child</DescriptorName>
      </MeshHeading>
    </MeshHeadingList>
  </MedlineCitation>
  <PubmedData>
    <History>
      <PubMedPubDate PubStatus="epublish">
        <Year>2023</Year>
        <Month>01</Month>
        <Day>05</Day>
      </PubMedPubDate>
    </History>
    <ArticleIdList>
      <ArticleId IdType="pubmed">12345678</ArticleId>
      <ArticleId IdType="doi">10.1016/j.jaci.2023.01.001</ArticleId>
    </ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);

describe('parsePubMedXml', () => {
  describe('single article parsing', () => {
    it('parses pmid correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results).toHaveLength(1);
      expect(results[0].pmid).toBe('12345678');
    });

    it('parses title correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].title).toBe('Mechanisms of allergic sensitization in children');
    });

    it('parses abstract correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].abstract).toBe('This study examines the mechanisms of allergic sensitization.');
    });

    it('parses authors correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].authors).toHaveLength(2);
      expect(results[0].authors[0]).toEqual({
        lastName: 'Smith',
        firstName: 'John A',
        initials: 'JA',
        affiliation: 'Department of Allergy, University Hospital, Boston, MA',
      });
      expect(results[0].authors[1]).toEqual({
        lastName: 'Doe',
        firstName: 'Jane',
        initials: 'J',
        affiliation: null,
      });
    });

    it('parses journal fields correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].journalTitle).toBe('Journal of Allergy and Clinical Immunology');
      expect(results[0].journalAbbreviation).toBe('J Allergy Clin Immunol');
      expect(results[0].volume).toBe('42');
      expect(results[0].issue).toBe('3');
      expect(results[0].pages).toBe('100-112');
    });

    it('parses publication date correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].publicationDate).toBe('2023-03-15');
    });

    it('parses epub date correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].epubDate).toBe('2023-01-05');
    });

    it('parses DOI correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].doi).toBe('10.1016/j.jaci.2023.01.001');
    });

    it('parses keywords correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].keywords).toEqual(['allergy', 'sensitization', 'children']);
    });

    it('parses mesh terms correctly', () => {
      const results = parsePubMedXml(SINGLE_ARTICLE_XML);
      expect(results[0].meshTerms).toEqual(['Hypersensitivity', 'Child']);
    });
  });

  describe('epub date fallback behavior', () => {
    it('uses ArticleDate when History/epublish is absent', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>12121212</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate>
            <Year>2024</Year>
            <Month>Mar</Month>
            <Day>15</Day>
          </PubDate>
        </JournalIssue>
        <Title>Electronic First Journal</Title>
        <ISOAbbreviation>EFirst J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Electronic date fallback article</ArticleTitle>
      <ArticleDate DateType="Electronic">
        <Year>2024</Year>
        <Month>01</Month>
        <Day>07</Day>
      </ArticleDate>
      <Abstract><AbstractText>Abstract.</AbstractText></Abstract>
      <AuthorList><Author><LastName>EpubFallback</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History />
    <ArticleIdList><ArticleId IdType="pubmed">12121212</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);

      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].epubDate).toBe('2024-01-07');
      expect(results[0].publicationDate).toBe('2024-03-15');
    });

    it('prefers ArticleDate electronic over PubMed indexing date', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>41783448</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate>
            <Year>2026</Year>
            <Month>May</Month>
          </PubDate>
        </JournalIssue>
        <Title>The journal of allergy and clinical immunology. Global</Title>
        <ISOAbbreviation>J Allergy Clin Immunol Glob</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Implementation of early peanut introduction among providers.</ArticleTitle>
      <ArticleDate DateType="Electronic">
        <Year>2026</Year>
        <Month>02</Month>
        <Day>09</Day>
      </ArticleDate>
      <Abstract><AbstractText>Abstract.</AbstractText></Abstract>
      <AuthorList><Author><LastName>Tester</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History>
      <PubMedPubDate PubStatus="pubmed">
        <Year>2026</Year>
        <Month>03</Month>
        <Day>05</Day>
      </PubMedPubDate>
    </History>
    <ArticleIdList><ArticleId IdType="pubmed">41783448</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);

      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].epubDate).toBe('2026-02-09');
      expect(results[0].publicationDate).toBe('2026-05-01');
    });
  });

  describe('batch parsing (multiple articles)', () => {
    it('parses multiple articles in a batch', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>11111111</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2022</Year><Month>Jan</Month><Day>01</Day></PubDate>
        </JournalIssue>
        <Title>Allergy</Title>
        <ISOAbbreviation>Allergy</ISOAbbreviation>
      </Journal>
      <ArticleTitle>First article</ArticleTitle>
      <Abstract><AbstractText>Abstract one</AbstractText></Abstract>
      <AuthorList><Author><LastName>Alpha</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">11111111</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
<PubmedArticle>
  <MedlineCitation>
    <PMID>22222222</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2022</Year><Month>Feb</Month><Day>10</Day></PubDate>
        </JournalIssue>
        <Title>Clinical Immunology</Title>
        <ISOAbbreviation>Clin Immunol</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Second article</ArticleTitle>
      <Abstract><AbstractText>Abstract two</AbstractText></Abstract>
      <AuthorList><Author><LastName>Beta</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">22222222</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(2);
      expect(results[0].pmid).toBe('11111111');
      expect(results[0].title).toBe('First article');
      expect(results[1].pmid).toBe('22222222');
      expect(results[1].title).toBe('Second article');
    });
  });

  describe('article without abstract', () => {
    it('returns null for abstract when absent', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>99999999</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2021</Year><Month>Jun</Month><Day>01</Day></PubDate>
        </JournalIssue>
        <Title>Test Journal</Title>
        <ISOAbbreviation>Test J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Article without abstract</ArticleTitle>
      <AuthorList><Author><LastName>NoAbstract</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">99999999</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].abstract).toBeNull();
    });
  });

  describe('structured abstract with labels', () => {
    it('joins labeled abstract sections with label prefixes', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>55555555</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2023</Year><Month>Apr</Month><Day>01</Day></PubDate>
        </JournalIssue>
        <Title>Test Journal</Title>
        <ISOAbbreviation>Test J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Structured abstract article</ArticleTitle>
      <Abstract>
        <AbstractText Label="BACKGROUND">Background information here.</AbstractText>
        <AbstractText Label="METHODS">Methods used in the study.</AbstractText>
        <AbstractText Label="RESULTS">Results of the study.</AbstractText>
        <AbstractText Label="CONCLUSIONS">Conclusions drawn.</AbstractText>
      </Abstract>
      <AuthorList><Author><LastName>Structured</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">55555555</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      const abstract = results[0].abstract;
      expect(abstract).toContain('BACKGROUND: Background information here.');
      expect(abstract).toContain('METHODS: Methods used in the study.');
      expect(abstract).toContain('RESULTS: Results of the study.');
      expect(abstract).toContain('CONCLUSIONS: Conclusions drawn.');
    });
  });

  describe('CollectiveName author handling', () => {
    it('uses CollectiveName as lastName when individual name fields absent', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>66666666</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2020</Year><Month>May</Month><Day>01</Day></PubDate>
        </JournalIssue>
        <Title>Collaborative Journal</Title>
        <ISOAbbreviation>Collab J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Collaborative study</ArticleTitle>
      <Abstract><AbstractText>Collaborative abstract.</AbstractText></Abstract>
      <AuthorList>
        <Author ValidYN="Y">
          <CollectiveName>The Allergy Research Consortium</CollectiveName>
        </Author>
        <Author ValidYN="Y">
          <LastName>Individual</LastName>
          <ForeName>Author</ForeName>
          <Initials>A</Initials>
        </Author>
      </AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">66666666</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].authors[0].lastName).toBe('The Allergy Research Consortium');
      expect(results[0].authors[0].firstName).toBeNull();
      expect(results[0].authors[1].lastName).toBe('Individual');
    });
  });

  describe('MedlineDate parsing (no Year field)', () => {
    it('extracts year from MedlineDate when Year element absent', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>77777777</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate>
            <MedlineDate>2019 Jan-Feb</MedlineDate>
          </PubDate>
        </JournalIssue>
        <Title>Medline Date Journal</Title>
        <ISOAbbreviation>MedlineDate J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Article with MedlineDate</ArticleTitle>
      <Abstract><AbstractText>Some abstract.</AbstractText></Abstract>
      <AuthorList><Author><LastName>MedlineTest</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">77777777</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].publicationDate).toBe('2019-01-01');
    });

    it('falls back to 1970-01-01 when no date info available', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>88888888</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate/>
        </JournalIssue>
        <Title>Unknown Date Journal</Title>
        <ISOAbbreviation>Unknown J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Article with no date</ArticleTitle>
      <Abstract><AbstractText>Abstract.</AbstractText></Abstract>
      <AuthorList><Author><LastName>NoDate</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">88888888</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].publicationDate).toBe('1970-01-01');
    });
  });

  describe('DOI extraction', () => {
    it('returns null doi when no DOI in ArticleIdList', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>33333333</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2021</Year><Month>Jul</Month><Day>01</Day></PubDate>
        </JournalIssue>
        <Title>No DOI Journal</Title>
        <ISOAbbreviation>No DOI J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Article without DOI</ArticleTitle>
      <Abstract><AbstractText>Abstract text.</AbstractText></Abstract>
      <AuthorList><Author><LastName>NoDoi</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList>
      <ArticleId IdType="pubmed">33333333</ArticleId>
      <ArticleId IdType="pmc">PMC1234567</ArticleId>
    </ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].doi).toBeNull();
    });

    it('extracts DOI correctly from ArticleIdList', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>44444444</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2022</Year><Month>Sep</Month><Day>20</Day></PubDate>
        </JournalIssue>
        <Title>DOI Journal</Title>
        <ISOAbbreviation>DOI J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Article with DOI</ArticleTitle>
      <Abstract><AbstractText>Abstract.</AbstractText></Abstract>
      <AuthorList><Author><LastName>WithDoi</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList>
      <ArticleId IdType="pubmed">44444444</ArticleId>
      <ArticleId IdType="doi">10.1234/test.doi.2022</ArticleId>
    </ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].doi).toBe('10.1234/test.doi.2022');
    });
  });

  describe('keywords and meshTerms arrays', () => {
    it('returns empty arrays when no keywords or mesh terms present', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>10101010</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2020</Year><Month>Dec</Month><Day>01</Day></PubDate>
        </JournalIssue>
        <Title>Plain Journal</Title>
        <ISOAbbreviation>Plain J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Article with no keywords or mesh</ArticleTitle>
      <Abstract><AbstractText>Abstract.</AbstractText></Abstract>
      <AuthorList><Author><LastName>Plain</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">10101010</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].keywords).toEqual([]);
      expect(results[0].meshTerms).toEqual([]);
    });
  });

  describe('empty or invalid XML error handling', () => {
    it('returns empty array for empty string input', () => {
      const results = parsePubMedXml('');
      expect(results).toEqual([]);
    });

    it('returns empty array for XML with empty PubmedArticleSet', () => {
      const results = parsePubMedXml('<?xml version="1.0"?><PubmedArticleSet></PubmedArticleSet>');
      expect(results).toEqual([]);
    });

    it('returns empty array for completely invalid XML', () => {
      const results = parsePubMedXml('not xml at all <<<>>>');
      expect(results).toEqual([]);
    });

    it('skips malformed articles but returns valid ones', () => {
      const xml = wrapInSet(`
<PubmedArticle>
  <MedlineCitation>
    <PMID>19999991</PMID>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">19999991</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
<PubmedArticle>
  <MedlineCitation>
    <PMID>29999992</PMID>
    <Article>
      <Journal>
        <JournalIssue CitedMedium="Internet">
          <PubDate><Year>2023</Year><Month>Jan</Month><Day>01</Day></PubDate>
        </JournalIssue>
        <Title>Valid Journal</Title>
        <ISOAbbreviation>Valid J</ISOAbbreviation>
      </Journal>
      <ArticleTitle>Valid article</ArticleTitle>
      <Abstract><AbstractText>Valid abstract.</AbstractText></Abstract>
      <AuthorList><Author><LastName>Valid</LastName></Author></AuthorList>
    </Article>
  </MedlineCitation>
  <PubmedData>
    <History/>
    <ArticleIdList><ArticleId IdType="pubmed">29999992</ArticleId></ArticleIdList>
  </PubmedData>
</PubmedArticle>
`);
      const results = parsePubMedXml(xml);
      expect(results).toHaveLength(1);
      expect(results[0].pmid).toBe('29999992');
    });
  });
});
